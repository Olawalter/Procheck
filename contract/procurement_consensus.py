# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json


class ProcurementConsensusProtocol(gl.Contract):
    rounds: TreeMap[str, str]
    bids: TreeMap[str, str]
    evaluations: TreeMap[str, str]
    appeals: TreeMap[str, str]
    round_counter: u256
    bid_counter: u256
    appeal_counter: u256

    def __init__(self) -> None:
        pass

    # ─── Round Methods ───────────────────────────────────────────────────────────

    @gl.public.write
    def create_round(
        self,
        title: str,
        category: str,
        description: str,
        quantity: str,
        budget_min: u256,
        budget_max: u256,
        criteria_text: str,
        criteria_weights: str,
        mandatory_requirements: str,
        bid_deadline: u256,
        appeal_window: u256,
    ) -> u256:
        assert len(title) >= 6 and len(title) <= 100, "Title must be 6-100 chars"
        assert len(category) >= 3 and len(category) <= 80, "Category must be 3-80 chars"
        assert len(description) >= 30, "Description must be at least 30 chars"
        assert budget_min > u256(0), "Budget min must be positive"
        assert budget_max >= budget_min, "Budget max must be >= budget min"
        assert appeal_window > u256(0), "Appeal window must be positive"

        weights = json.loads(criteria_weights)
        assert isinstance(weights, dict) and len(weights) > 0, "Criteria weights must be a non-empty JSON object"
        total = sum(int(v) for v in weights.values())
        assert total == 100, "Criteria weights must sum to 100"

        reqs = json.loads(mandatory_requirements)
        assert isinstance(reqs, list) and 1 <= len(reqs) <= 12, "Mandatory requirements must be 1-12 items"

        self.round_counter = u256(int(self.round_counter) + 1)
        round_id = int(self.round_counter)
        key = str(round_id)

        self.rounds[key] = json.dumps({
            "round_id": round_id,
            "buyer": str(gl.message.sender_address),
            "title": title,
            "category": category,
            "description": description,
            "quantity": quantity,
            "budget_min": int(budget_min),
            "budget_max": int(budget_max),
            "criteria_text": criteria_text,
            "criteria_weights": criteria_weights,
            "mandatory_requirements": mandatory_requirements,
            "bid_deadline": int(bid_deadline),
            "appeal_window": int(appeal_window),
            "status": "draft",
            "created_at": 0,
            "finalized": False,
            "bid_ids": [],
        })
        return self.round_counter

    @gl.public.write
    def open_round(self, round_id: u256) -> None:
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        assert raw, "Round not found"
        r = json.loads(raw)
        assert r["buyer"] == str(gl.message.sender_address), "Only buyer can open round"
        assert r["status"] == "draft", "Round must be in draft status"
        r["status"] = "open_for_bids"
        self.rounds[key] = json.dumps(r)

    @gl.public.write
    def cancel_round(self, round_id: u256) -> None:
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        assert raw, "Round not found"
        r = json.loads(raw)
        assert r["buyer"] == str(gl.message.sender_address), "Only buyer can cancel round"
        assert r["status"] in ("draft", "open_for_bids"), "Cannot cancel at this stage"
        assert len(r["bid_ids"]) == 0, "Cannot cancel a round that already has bids"
        r["status"] = "cancelled"
        self.rounds[key] = json.dumps(r)

    @gl.public.write
    def close_bids(self, round_id: u256) -> None:
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        assert raw, "Round not found"
        r = json.loads(raw)
        assert r["buyer"] == str(gl.message.sender_address), "Only buyer can close bids"
        assert r["status"] == "open_for_bids", "Round must be open for bids"
        r["status"] = "bid_submission_closed"
        self.rounds[key] = json.dumps(r)

    # ─── Bid Methods ─────────────────────────────────────────────────────────────

    @gl.public.write
    def submit_bid(
        self,
        round_id: u256,
        price: u256,
        delivery_timeline_days: u256,
        technical_summary: str,
        warranty_terms: str,
        compliance_statement: str,
        evidence_urls: str,
    ) -> u256:
        round_key = str(int(round_id))
        raw_round = self.rounds.get(round_key, "")
        assert raw_round, "Round not found"
        r = json.loads(raw_round)
        assert r["status"] == "open_for_bids", "Round is not open for bids"
        assert int(price) > 0, "Price must be positive"
        assert len(technical_summary) >= 50, "Technical summary must be at least 50 chars"
        assert len(compliance_statement) >= 30, "Compliance statement must be at least 30 chars"

        urls = json.loads(evidence_urls)
        assert isinstance(urls, list) and len(urls) >= 1, "Evidence URLs must have at least 1 item"

        supplier = str(gl.message.sender_address)
        for existing_id in r["bid_ids"]:
            raw_b = self.bids.get(str(existing_id), "")
            if raw_b:
                b = json.loads(raw_b)
                assert b["supplier"] != supplier, "Supplier already submitted a bid; use revise_bid"

        self.bid_counter = u256(int(self.bid_counter) + 1)
        bid_id = int(self.bid_counter)
        bid_key = str(bid_id)

        self.bids[bid_key] = json.dumps({
            "bid_id": bid_id,
            "round_id": int(round_id),
            "supplier": supplier,
            "price": int(price),
            "delivery_timeline_days": int(delivery_timeline_days),
            "technical_summary": technical_summary,
            "warranty_terms": warranty_terms,
            "compliance_statement": compliance_statement,
            "evidence_urls": evidence_urls,
            "submitted_at": 0,
            "revised_at": 0,
            "status": "submitted",
        })

        r["bid_ids"].append(bid_id)
        self.rounds[round_key] = json.dumps(r)
        return self.bid_counter

    @gl.public.write
    def revise_bid(
        self,
        bid_id: u256,
        price: u256,
        delivery_timeline_days: u256,
        technical_summary: str,
        warranty_terms: str,
        compliance_statement: str,
        evidence_urls: str,
    ) -> None:
        bid_key = str(int(bid_id))
        raw_b = self.bids.get(bid_key, "")
        assert raw_b, "Bid not found"
        b = json.loads(raw_b)
        assert b["supplier"] == str(gl.message.sender_address), "Only the original supplier can revise this bid"

        round_key = str(b["round_id"])
        raw_r = self.rounds.get(round_key, "")
        assert raw_r, "Round not found"
        r = json.loads(raw_r)
        assert r["status"] == "open_for_bids", "Round is not open for bids"
        assert int(price) > 0, "Price must be positive"
        assert len(technical_summary) >= 50, "Technical summary must be at least 50 chars"
        assert len(compliance_statement) >= 30, "Compliance statement must be at least 30 chars"

        urls = json.loads(evidence_urls)
        assert isinstance(urls, list) and len(urls) >= 1, "Evidence URLs must have at least 1 item"

        b["price"] = int(price)
        b["delivery_timeline_days"] = int(delivery_timeline_days)
        b["technical_summary"] = technical_summary
        b["warranty_terms"] = warranty_terms
        b["compliance_statement"] = compliance_statement
        b["evidence_urls"] = evidence_urls
        self.bids[bid_key] = json.dumps(b)

    # ─── Evaluation ──────────────────────────────────────────────────────────────

    @gl.public.write
    def request_evaluation(self, round_id: u256) -> None:
        round_key = str(int(round_id))
        raw_r = self.rounds.get(round_key, "")
        assert raw_r, "Round not found"
        r = json.loads(raw_r)
        assert r["buyer"] == str(gl.message.sender_address), "Only buyer can request evaluation"
        assert r["status"] == "bid_submission_closed", "Bids must be closed before evaluation"
        assert len(r["bid_ids"]) > 0, "No bids submitted for this round"

        r["status"] = "under_consensus_evaluation"
        self.rounds[round_key] = json.dumps(r)

        bids_text_parts = []
        for idx, bid_id in enumerate(r["bid_ids"], 1):
            raw_b = self.bids.get(str(bid_id), "")
            if raw_b:
                b = json.loads(raw_b)
                bids_text_parts.append(
                    f"Bid {idx} (ID: {bid_id}, Supplier: {b['supplier']}):\n"
                    f"  Price: {b['price']} GEN\n"
                    f"  Delivery: {b['delivery_timeline_days']} days\n"
                    f"  Technical: {b['technical_summary']}\n"
                    f"  Warranty: {b['warranty_terms']}\n"
                    f"  Compliance: {b['compliance_statement']}\n"
                    f"  Evidence URLs: {b['evidence_urls']}"
                )
        bids_text = "\n\n".join(bids_text_parts)

        weights = json.loads(r["criteria_weights"])
        weights_text = "\n".join(f"  {k}: {v}%" for k, v in weights.items())
        reqs = json.loads(r["mandatory_requirements"])
        reqs_text = "\n".join(f"  - {req}" for req in reqs)

        prompt = (
            "You are evaluating a procurement round for Procurement Consensus.\n\n"
            "This is not a lowest-price auction. Select the best-value bid based on the buyer's stated criteria.\n\n"
            f"PROCUREMENT ROUND:\nTitle: {r['title']}\nCategory: {r['category']}\n"
            f"Description: {r['description']}\nQuantity: {r['quantity']}\n"
            f"Budget range: {r['budget_min']} to {r['budget_max']} GEN\n\n"
            f"EVALUATION CRITERIA AND WEIGHTS:\n{weights_text}\n\n"
            f"MANDATORY REQUIREMENTS (all must be satisfied to qualify):\n{reqs_text}\n\n"
            f"SUBMITTED BIDS:\n{bids_text}\n\n"
            "Evaluate which bid provides the best overall value under the stated criteria and weights.\n"
            "Consider: specification fit, price-to-quality ratio, delivery credibility, compliance evidence, and risk.\n\n"
            'Return ONLY a valid JSON object with this exact structure:\n'
            '{\n'
            '  "verdict": "award_recommended or no_valid_bid or tie_detected or insufficient_evidence or unverifiable or manual_review_required",\n'
            '  "recommended_bid_id": <integer bid ID or 0 if no winner>,\n'
            '  "recommended_supplier": "<supplier address or empty string>",\n'
            '  "confidence": <integer 0-100>,\n'
            '  "quality_band": "poor or weak or acceptable or strong or excellent",\n'
            '  "price_value_band": "overpriced or questionable or fair or good_value or exceptional_value",\n'
            '  "compliance_band": "non_compliant or weak or partial or strong or complete",\n'
            '  "risk_band": "high or medium or low or minimal",\n'
            '  "reason_code": "<short_snake_case_string>",\n'
            '  "short_reason": "<max 240 chars explaining the decision>",\n'
            '  "appeal_allowed": true or false\n'
            '}\n'
            "It is mandatory that you respond only using the JSON format above, nothing else."
        )

        def leader_fn():
            return gl.nondet.exec_prompt(prompt, response_format='json')

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            data = leaders_res.calldata
            if not isinstance(data, dict):
                return False
            valid_verdicts = [
                "award_recommended", "no_valid_bid", "tie_detected",
                "insufficient_evidence", "unverifiable", "manual_review_required",
            ]
            if data.get("verdict") not in valid_verdicts:
                return False
            confidence = data.get("confidence")
            if not isinstance(confidence, int):
                return False
            if confidence < 0 or confidence > 100:
                return False
            valid_quality = ["poor", "weak", "acceptable", "strong", "excellent"]
            if data.get("quality_band") not in valid_quality:
                return False
            valid_price = ["overpriced", "questionable", "fair", "good_value", "exceptional_value"]
            if data.get("price_value_band") not in valid_price:
                return False
            valid_compliance = ["non_compliant", "weak", "partial", "strong", "complete"]
            if data.get("compliance_band") not in valid_compliance:
                return False
            valid_risk = ["high", "medium", "low", "minimal"]
            if data.get("risk_band") not in valid_risk:
                return False
            return True

        eval_result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        verdict = str(eval_result.get("verdict", "manual_review_required"))
        confidence = min(100, max(0, int(eval_result.get("confidence", 0))))

        self.evaluations[round_key] = json.dumps({
            "round_id": int(round_id),
            "verdict": verdict,
            "recommended_bid_id": int(eval_result.get("recommended_bid_id", 0)),
            "recommended_supplier": str(eval_result.get("recommended_supplier", "")),
            "confidence": confidence,
            "quality_band": str(eval_result.get("quality_band", "acceptable")),
            "price_value_band": str(eval_result.get("price_value_band", "fair")),
            "compliance_band": str(eval_result.get("compliance_band", "partial")),
            "risk_band": str(eval_result.get("risk_band", "medium")),
            "reason_code": str(eval_result.get("reason_code", "evaluated")),
            "short_reason": str(eval_result.get("short_reason", ""))[:240],
            "appeal_allowed": bool(eval_result.get("appeal_allowed", True)),
            "issued_at": 0,
        })

        if verdict in ("no_valid_bid", "insufficient_evidence", "unverifiable", "manual_review_required"):
            r["status"] = verdict
        else:
            r["status"] = "appeal_window_open"
        self.rounds[round_key] = json.dumps(r)

    # ─── Appeal ──────────────────────────────────────────────────────────────────

    @gl.public.write
    def file_appeal(
        self,
        round_id: u256,
        basis: str,
        statement: str,
        evidence_urls: str,
    ) -> None:
        valid_bases = [
            "new_compliance_evidence", "price_miscalculation", "technical_spec_misread",
            "delivery_timeline_misread", "supplier_identity_error", "evidence_url_misread",
            "criteria_weighting_error", "conflict_of_interest_claim",
        ]
        round_key = str(int(round_id))
        raw_r = self.rounds.get(round_key, "")
        assert raw_r, "Round not found"
        r = json.loads(raw_r)
        assert r["status"] == "appeal_window_open", "Appeal window is not open"
        assert basis in valid_bases, "Invalid appeal basis"
        assert len(statement) >= 20, "Appeal statement must be at least 20 chars"

        urls = json.loads(evidence_urls)
        assert isinstance(urls, list), "Evidence URLs must be a JSON list"

        self.appeal_counter = u256(int(self.appeal_counter) + 1)
        appeal_id = int(self.appeal_counter)

        self.appeals[round_key] = json.dumps({
            "appeal_id": appeal_id,
            "round_id": int(round_id),
            "filed_by": str(gl.message.sender_address),
            "basis": basis,
            "statement": statement,
            "evidence_urls": evidence_urls,
            "status": "filed",
            "result": "",
            "created_at": 0,
        })
        r["status"] = "appeal_under_review"
        self.rounds[round_key] = json.dumps(r)

    @gl.public.write
    def request_appeal_review(self, round_id: u256) -> None:
        round_key = str(int(round_id))
        raw_r = self.rounds.get(round_key, "")
        assert raw_r, "Round not found"
        r = json.loads(raw_r)
        assert r["buyer"] == str(gl.message.sender_address), "Only buyer can request appeal review"
        assert r["status"] == "appeal_under_review", "No appeal is under review"

        raw_appeal = self.appeals.get(round_key, "")
        assert raw_appeal, "No appeal found"
        appeal = json.loads(raw_appeal)

        raw_eval = self.evaluations.get(round_key, "")
        assert raw_eval, "No evaluation found"
        original_eval = json.loads(raw_eval)

        bids_text_parts = []
        for bid_id in r["bid_ids"]:
            raw_b = self.bids.get(str(bid_id), "")
            if raw_b:
                b = json.loads(raw_b)
                bids_text_parts.append(
                    f"Bid ID {bid_id} (Supplier: {b['supplier']}):\n"
                    f"  Price: {b['price']}\n"
                    f"  Delivery: {b['delivery_timeline_days']} days\n"
                    f"  Technical: {b['technical_summary']}"
                )
        bids_text = "\n\n".join(bids_text_parts)

        prompt = (
            "You are reviewing an appeal for a procurement evaluation on Procurement Consensus.\n\n"
            f"ORIGINAL ROUND:\nTitle: {r['title']}\nCategory: {r['category']}\n"
            f"Criteria weights: {r['criteria_weights']}\n"
            f"Mandatory requirements: {r['mandatory_requirements']}\n\n"
            f"ORIGINAL EVALUATION:\nVerdict: {original_eval['verdict']}\n"
            f"Recommended bid ID: {original_eval['recommended_bid_id']}\n"
            f"Confidence: {original_eval['confidence']}%\n"
            f"Reason: {original_eval['short_reason']}\n\n"
            f"APPEAL:\nFiled by: {appeal['filed_by']}\n"
            f"Basis: {appeal['basis']}\nStatement: {appeal['statement']}\n"
            f"Additional evidence: {appeal['evidence_urls']}\n\n"
            f"ALL SUBMITTED BIDS:\n{bids_text}\n\n"
            "Does the appeal introduce meaningful evidence that was overlooked? Should the recommendation change?\n\n"
            'Return ONLY a valid JSON object:\n'
            '{\n'
            '  "appeal_verdict": "appeal_granted or appeal_rejected or manual_review_required",\n'
            '  "final_recommendation_changed": true or false,\n'
            '  "new_recommended_bid_id": <integer, same as original if unchanged>,\n'
            '  "confidence": <integer 0-100>,\n'
            '  "reason_code": "<short_snake_case_string>",\n'
            '  "short_reason": "<max 240 chars>"\n'
            '}\n'
            "It is mandatory that you respond only using the JSON format above, nothing else."
        )

        def appeal_leader_fn():
            return gl.nondet.exec_prompt(prompt, response_format='json')

        def appeal_validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            data = leaders_res.calldata
            if not isinstance(data, dict):
                return False
            valid_verdicts = ("appeal_granted", "appeal_rejected", "manual_review_required")
            if data.get("appeal_verdict") not in valid_verdicts:
                return False
            if not isinstance(data.get("final_recommendation_changed"), bool):
                return False
            return True

        appeal_result = gl.vm.run_nondet_unsafe(appeal_leader_fn, appeal_validator_fn)

        appeal["result"] = json.dumps(appeal_result)
        appeal["status"] = "reviewed"
        self.appeals[round_key] = json.dumps(appeal)

        if appeal_result.get("final_recommendation_changed", False):
            original_eval["recommended_bid_id"] = int(
                appeal_result.get("new_recommended_bid_id", original_eval["recommended_bid_id"])
            )
            original_eval["verdict"] = "award_recommended"
            self.evaluations[round_key] = json.dumps(original_eval)

        r["status"] = "recommendation_issued"
        self.rounds[round_key] = json.dumps(r)

    @gl.public.write
    def finalize_recommendation(self, round_id: u256) -> None:
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        assert raw, "Round not found"
        r = json.loads(raw)
        assert r["buyer"] == str(gl.message.sender_address), "Only buyer can finalize"
        assert r["status"] in ("recommendation_issued", "appeal_window_open"), "No recommendation to finalize"
        r["status"] = "finalized"
        r["finalized"] = True
        self.rounds[key] = json.dumps(r)

    # ─── Read Methods — all return str (JSON-serialized) ─────────────────────────

    @gl.public.view
    def get_round(self, round_id: u256) -> str:
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        assert raw, "Round not found"
        return raw

    @gl.public.view
    def get_bid(self, bid_id: u256) -> str:
        key = str(int(bid_id))
        raw = self.bids.get(key, "")
        assert raw, "Bid not found"
        return raw

    @gl.public.view
    def get_round_bids(self, round_id: u256) -> str:
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        assert raw, "Round not found"
        r = json.loads(raw)
        result = []
        for bid_id in r["bid_ids"]:
            raw_b = self.bids.get(str(bid_id), "")
            if raw_b:
                result.append(json.loads(raw_b))
        return json.dumps(result)

    @gl.public.view
    def get_evaluation_result(self, round_id: u256) -> str:
        key = str(int(round_id))
        raw = self.evaluations.get(key, "")
        if not raw:
            return "{}"
        return raw

    @gl.public.view
    def get_appeal(self, round_id: u256) -> str:
        key = str(int(round_id))
        raw = self.appeals.get(key, "")
        if not raw:
            return "{}"
        return raw

    @gl.public.view
    def get_all_rounds(self) -> str:
        result = []
        counter = int(self.round_counter)
        for i in range(1, counter + 1):
            raw = self.rounds.get(str(i), "")
            if raw:
                r = json.loads(raw)
                result.append({
                    "round_id": r["round_id"],
                    "buyer": r["buyer"],
                    "title": r["title"],
                    "category": r["category"],
                    "description": r["description"],
                    "quantity": r["quantity"],
                    "budget_min": r["budget_min"],
                    "budget_max": r["budget_max"],
                    "bid_deadline": r["bid_deadline"],
                    "status": r["status"],
                    "created_at": r["created_at"],
                    "finalized": r["finalized"],
                    "bid_count": len(r["bid_ids"]),
                })
        return json.dumps(result)

    @gl.public.view
    def get_rounds_by_buyer(self, buyer_address: str) -> str:
        result = []
        counter = int(self.round_counter)
        for i in range(1, counter + 1):
            raw = self.rounds.get(str(i), "")
            if raw:
                r = json.loads(raw)
                if r["buyer"] == buyer_address:
                    result.append({
                        "round_id": r["round_id"],
                        "title": r["title"],
                        "category": r["category"],
                        "status": r["status"],
                        "bid_deadline": r["bid_deadline"],
                        "created_at": r["created_at"],
                        "finalized": r["finalized"],
                        "bid_count": len(r["bid_ids"]),
                    })
        return json.dumps(result)

    @gl.public.view
    def get_bids_by_supplier(self, supplier_address: str) -> str:
        result = []
        counter = int(self.bid_counter)
        for i in range(1, counter + 1):
            raw = self.bids.get(str(i), "")
            if raw:
                b = json.loads(raw)
                if b["supplier"] == supplier_address:
                    result.append({
                        "bid_id": b["bid_id"],
                        "round_id": b["round_id"],
                        "price": b["price"],
                        "delivery_timeline_days": b["delivery_timeline_days"],
                        "status": b["status"],
                        "submitted_at": b["submitted_at"],
                    })
        return json.dumps(result)

    @gl.public.view
    def get_contract_stats(self) -> str:
        return json.dumps({
            "total_rounds": int(self.round_counter),
            "total_bids": int(self.bid_counter),
            "total_appeals": int(self.appeal_counter),
        })
