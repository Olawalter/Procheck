# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json


# ── GEN emission ─────────────────────────────────────────────────────────────
# Every payout in this contract routes through _send_gen.
# The EVM interface stub gives us emit_transfer so GEN can leave the contract.

@gl.evm.contract_interface
class _Recipient:
    class View:
        pass
    class Write:
        pass


def _send_gen(to_address: str, amount: u256) -> None:
    if not to_address:
        raise gl.vm.UserError("Missing recipient address")
    if amount <= u256(0):
        raise gl.vm.UserError("Transfer amount must be positive")
    _Recipient(Address(to_address)).emit_transfer(value=amount)


# ── Contract ──────────────────────────────────────────────────────────────────

class ProcurementConsensusProtocol(gl.Contract):
    """
    Procurement Consensus — on-chain bid evaluation with:
      - Substantive validator verification (evidence fetch + independent LLM re-evaluation)
      - GEN escrow custody and automatic release on finalization
    """
    rounds: TreeMap[str, str]
    bids: TreeMap[str, str]
    evaluations: TreeMap[str, str]
    appeals: TreeMap[str, str]
    round_counter: u256
    bid_counter: u256
    appeal_counter: u256

    def __init__(self) -> None:
        pass

    # ── Storage helpers ───────────────────────────────────────────────────────

    def _get_escrow(self, r: dict) -> u256:
        """Read the locked escrow amount from a round dict."""
        return u256(int(r.get("escrow_deposited", "0")))

    def _set_escrow(self, r: dict, amount: u256) -> None:
        r["escrow_deposited"] = str(int(amount))

    def _build_bids_text(self, bid_ids: list) -> str:
        parts = []
        for idx, bid_id in enumerate(bid_ids, 1):
            raw_b = self.bids.get(str(bid_id), "")
            if raw_b:
                b = json.loads(raw_b)
                parts.append(
                    f"Bid {idx} (ID: {bid_id}, Supplier: {b['supplier']}):\n"
                    f"  Price: {b['price']} GEN\n"
                    f"  Delivery: {b['delivery_timeline_days']} days\n"
                    f"  Technical: {b['technical_summary']}\n"
                    f"  Warranty: {b['warranty_terms']}\n"
                    f"  Compliance: {b['compliance_statement']}\n"
                    f"  Evidence URLs: {b['evidence_urls']}"
                )
        return "\n\n".join(parts)

    # ── Round methods ─────────────────────────────────────────────────────────

    @gl.public.write.payable
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
        if len(title) < 6 or len(title) > 100:
            raise gl.vm.UserError("Title must be 6-100 chars")
        if len(category) < 3 or len(category) > 80:
            raise gl.vm.UserError("Category must be 3-80 chars")
        if len(description) < 30:
            raise gl.vm.UserError("Description must be at least 30 chars")
        if budget_min <= u256(0):
            raise gl.vm.UserError("Budget min must be positive")
        if budget_max < budget_min:
            raise gl.vm.UserError("Budget max must be >= budget min")
        if appeal_window <= u256(0):
            raise gl.vm.UserError("Appeal window must be positive")

        weights = json.loads(criteria_weights)
        if not isinstance(weights, dict) or len(weights) == 0:
            raise gl.vm.UserError("Criteria weights must be a non-empty JSON object")
        total = sum(int(v) for v in weights.values())
        if total != 100:
            raise gl.vm.UserError("Criteria weights must sum to 100")

        reqs = json.loads(mandatory_requirements)
        if not isinstance(reqs, list) or not (1 <= len(reqs) <= 12):
            raise gl.vm.UserError("Mandatory requirements must be 1-12 items")

        self.round_counter = u256(int(self.round_counter) + 1)
        round_id = int(self.round_counter)
        key = str(round_id)

        # Lock any GEN sent with this call as escrow.
        # gl.message.value is available because of @gl.public.write.payable.
        escrow = gl.message.value  # u256

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
            "escrow_deposited": str(int(escrow)),
        })
        return self.round_counter

    @gl.public.write.payable
    def deposit_escrow(self, round_id: u256) -> None:
        """Buyer adds more GEN to the round's escrow after creation."""
        round_key = str(int(round_id))
        raw_r = self.rounds.get(round_key, "")
        if not raw_r:
            raise gl.vm.UserError("Round not found")
        r = json.loads(raw_r)
        if r["buyer"] != str(gl.message.sender_address):
            raise gl.vm.UserError("Only buyer can deposit escrow")
        if r["status"] not in ("draft", "open_for_bids", "bid_submission_closed"):
            raise gl.vm.UserError("Cannot deposit escrow at this stage")
        amount = gl.message.value
        if amount <= u256(0):
            raise gl.vm.UserError("Must send GEN to deposit escrow")
        new_total = self._get_escrow(r) + amount
        self._set_escrow(r, new_total)
        self.rounds[round_key] = json.dumps(r)

    @gl.public.write
    def open_round(self, round_id: u256) -> None:
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        if not raw:
            raise gl.vm.UserError("Round not found")
        r = json.loads(raw)
        if r["buyer"] != str(gl.message.sender_address):
            raise gl.vm.UserError("Only buyer can open round")
        if r["status"] != "draft":
            raise gl.vm.UserError("Round must be in draft status")
        r["status"] = "open_for_bids"
        self.rounds[key] = json.dumps(r)

    @gl.public.write
    def cancel_round(self, round_id: u256) -> None:
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        if not raw:
            raise gl.vm.UserError("Round not found")
        r = json.loads(raw)
        if r["buyer"] != str(gl.message.sender_address):
            raise gl.vm.UserError("Only buyer can cancel round")
        if r["status"] not in ("draft", "open_for_bids"):
            raise gl.vm.UserError("Cannot cancel at this stage")
        if len(r["bid_ids"]) != 0:
            raise gl.vm.UserError("Cannot cancel a round that already has bids")

        # Read escrow → zero it → save → then transfer (reentrancy-safe ordering)
        locked = self._get_escrow(r)
        buyer = r["buyer"]
        r["status"] = "cancelled"
        self._set_escrow(r, u256(0))
        self.rounds[key] = json.dumps(r)

        if locked > u256(0):
            _send_gen(buyer, locked)

    @gl.public.write
    def close_bids(self, round_id: u256) -> None:
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        if not raw:
            raise gl.vm.UserError("Round not found")
        r = json.loads(raw)
        if r["buyer"] != str(gl.message.sender_address):
            raise gl.vm.UserError("Only buyer can close bids")
        if r["status"] != "open_for_bids":
            raise gl.vm.UserError("Round must be open for bids")
        r["status"] = "bid_submission_closed"
        self.rounds[key] = json.dumps(r)

    # ── Bid methods ───────────────────────────────────────────────────────────

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
        if not raw_round:
            raise gl.vm.UserError("Round not found")
        r = json.loads(raw_round)
        if r["status"] != "open_for_bids":
            raise gl.vm.UserError("Round is not open for bids")
        if price <= u256(0):
            raise gl.vm.UserError("Price must be positive")
        if len(technical_summary) < 50:
            raise gl.vm.UserError("Technical summary must be at least 50 chars")
        if len(compliance_statement) < 30:
            raise gl.vm.UserError("Compliance statement must be at least 30 chars")

        urls = json.loads(evidence_urls)
        if not isinstance(urls, list) or len(urls) < 1:
            raise gl.vm.UserError("Evidence URLs must have at least 1 item")

        supplier = str(gl.message.sender_address)
        for existing_id in r["bid_ids"]:
            raw_b = self.bids.get(str(existing_id), "")
            if raw_b:
                b = json.loads(raw_b)
                if b["supplier"] == supplier:
                    raise gl.vm.UserError("Supplier already submitted a bid; use revise_bid")

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
        if not raw_b:
            raise gl.vm.UserError("Bid not found")
        b = json.loads(raw_b)
        if b["supplier"] != str(gl.message.sender_address):
            raise gl.vm.UserError("Only the original supplier can revise this bid")

        round_key = str(b["round_id"])
        raw_r = self.rounds.get(round_key, "")
        if not raw_r:
            raise gl.vm.UserError("Round not found")
        r = json.loads(raw_r)
        if r["status"] != "open_for_bids":
            raise gl.vm.UserError("Round is not open for bids")
        if price <= u256(0):
            raise gl.vm.UserError("Price must be positive")
        if len(technical_summary) < 50:
            raise gl.vm.UserError("Technical summary must be at least 50 chars")
        if len(compliance_statement) < 30:
            raise gl.vm.UserError("Compliance statement must be at least 30 chars")

        urls = json.loads(evidence_urls)
        if not isinstance(urls, list) or len(urls) < 1:
            raise gl.vm.UserError("Evidence URLs must have at least 1 item")

        b["price"] = int(price)
        b["delivery_timeline_days"] = int(delivery_timeline_days)
        b["technical_summary"] = technical_summary
        b["warranty_terms"] = warranty_terms
        b["compliance_statement"] = compliance_statement
        b["evidence_urls"] = evidence_urls
        self.bids[bid_key] = json.dumps(b)

    # ── Evaluation ────────────────────────────────────────────────────────────

    @gl.public.write
    def request_evaluation(self, round_id: u256) -> None:
        round_key = str(int(round_id))
        raw_r = self.rounds.get(round_key, "")
        if not raw_r:
            raise gl.vm.UserError("Round not found")
        r = json.loads(raw_r)
        if r["buyer"] != str(gl.message.sender_address):
            raise gl.vm.UserError("Only buyer can request evaluation")
        if r["status"] != "bid_submission_closed":
            raise gl.vm.UserError("Bids must be closed before evaluation")
        if len(r["bid_ids"]) == 0:
            raise gl.vm.UserError("No bids submitted for this round")

        r["status"] = "under_consensus_evaluation"
        self.rounds[round_key] = json.dumps(r)

        bids_text = self._build_bids_text(r["bid_ids"])
        weights_text = "\n".join(
            f"  {k}: {v}%" for k, v in json.loads(r["criteria_weights"]).items()
        )
        reqs_text = "\n".join(
            f"  - {req}" for req in json.loads(r["mandatory_requirements"])
        )
        valid_bid_ids = list(r["bid_ids"])

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

        # Pre-build plain Python dicts for the validator closure.
        # TreeMaps cannot be accessed from inside validator_fn, so we snapshot
        # all bid data into plain dicts and lists before defining the closures.
        _valid_bid_ids = valid_bid_ids
        _bid_suppliers = {}
        _bid_evidence_urls = {}  # bid_id → list of URL strings
        for bid_id in valid_bid_ids:
            raw_b = self.bids.get(str(bid_id), "")
            if raw_b:
                b = json.loads(raw_b)
                _bid_suppliers[bid_id] = b.get("supplier", "")
                _bid_evidence_urls[bid_id] = json.loads(b.get("evidence_urls", "[]"))

        # Plain strings for the validator's independent LLM check.
        _title = r["title"]
        _captured_bids_text = bids_text

        def leader_fn():
            return gl.nondet.exec_prompt(prompt, response_format='json')

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            data = leaders_res.calldata
            if not isinstance(data, dict):
                return False

            # ── Structural checks ────────────────────────────────────────────
            valid_verdicts = [
                "award_recommended", "no_valid_bid", "tie_detected",
                "insufficient_evidence", "unverifiable", "manual_review_required",
            ]
            if data.get("verdict") not in valid_verdicts:
                return False
            confidence = data.get("confidence")
            if not isinstance(confidence, int) or confidence < 0 or confidence > 100:
                return False
            if data.get("quality_band") not in ["poor", "weak", "acceptable", "strong", "excellent"]:
                return False
            if data.get("price_value_band") not in ["overpriced", "questionable", "fair", "good_value", "exceptional_value"]:
                return False
            if data.get("compliance_band") not in ["non_compliant", "weak", "partial", "strong", "complete"]:
                return False
            if data.get("risk_band") not in ["high", "medium", "low", "minimal"]:
                return False

            # ── Deterministic on-chain consistency checks ────────────────────
            verdict = data.get("verdict")
            recommended_bid_id = data.get("recommended_bid_id")
            recommended_supplier = str(data.get("recommended_supplier", ""))

            if verdict == "award_recommended":
                # Bid must be one actually submitted to this round
                if recommended_bid_id not in _valid_bid_ids:
                    return False
                # Supplier must match the on-chain bid record
                if _bid_suppliers.get(recommended_bid_id, "") != recommended_supplier:
                    return False
                # Winning bid must have at least one evidence URL registered on-chain
                winner_urls = _bid_evidence_urls.get(recommended_bid_id, [])
                if not winner_urls:
                    return False

                # ── Fetch and authenticate evidence (GenLayer web scrape) ─────
                # Each validator independently fetches the winner's evidence URL
                # and reads its content. This authenticates that the evidence
                # actually exists and is accessible — not just that a URL was
                # registered on-chain.
                evidence_text = "[evidence fetch failed]"
                try:
                    raw = gl.nondet.web_scrape(winner_urls[0])
                    evidence_text = str(raw.text)[:1000] if hasattr(raw, 'text') else str(raw)[:1000]
                except Exception:
                    pass  # fetch failure is surfaced to the LLM below

                # ── Independent LLM re-evaluation with fetched evidence ───────
                # Each validator independently reasons about the winner using the
                # on-chain bid data AND the live-fetched evidence content.
                # Non-deterministic agreement on a substantive procurement
                # judgement — the GenLayer Equivalence Principle applied.
                spot_prompt = (
                    f"Procurement: {_title}\n\n"
                    f"Submitted bids:\n{_captured_bids_text}\n\n"
                    f"The proposed winner is Bid {recommended_bid_id} "
                    f"(Supplier {recommended_supplier}).\n\n"
                    f"Evidence fetched from {winner_urls[0]}:\n{evidence_text}\n\n"
                    "Does the fetched evidence credibly support this supplier's claims "
                    "for this procurement? And is this a reasonable best-value selection "
                    "given price, delivery, quality, and compliance? "
                    'Reply ONLY with valid JSON: {"agree": true} or {"agree": false}'
                )
                try:
                    spot = gl.nondet.exec_prompt(spot_prompt, response_format='json')
                    if not isinstance(spot, dict):
                        return False
                    if not spot.get("agree", False):
                        return False
                except Exception:
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

        no_winner_verdicts = (
            "no_valid_bid", "insufficient_evidence", "unverifiable", "manual_review_required"
        )
        if verdict in no_winner_verdicts:
            r["status"] = verdict
            # No winner — refund escrow to buyer now.
            # Zero first, save, then transfer (reentrancy-safe).
            locked = self._get_escrow(r)
            buyer = r["buyer"]
            self._set_escrow(r, u256(0))
            self.rounds[round_key] = json.dumps(r)
            if locked > u256(0):
                _send_gen(buyer, locked)
        else:
            r["status"] = "appeal_window_open"
            self.rounds[round_key] = json.dumps(r)

    @gl.public.write
    def close_appeal_window(self, round_id: u256) -> None:
        """
        Close the appeal window when no appeal has been filed.
        Callable by anyone — transitions the round to recommendation_issued
        so that finalize_recommendation can be called to release escrow.
        In a production system this would be time-gated (block timestamp);
        on StudioNet the appeal window duration is enforced at the UI layer.
        """
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        if not raw:
            raise gl.vm.UserError("Round not found")
        r = json.loads(raw)
        if r["status"] != "appeal_window_open":
            raise gl.vm.UserError("No open appeal window to close")
        # Ensure no appeal has been filed
        if self.appeals.get(key, ""):
            raise gl.vm.UserError("An appeal is already filed — use request_appeal_review instead")
        r["status"] = "recommendation_issued"
        self.rounds[key] = json.dumps(r)

    # ── Appeal ────────────────────────────────────────────────────────────────

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
        if not raw_r:
            raise gl.vm.UserError("Round not found")
        r = json.loads(raw_r)
        if r["status"] != "appeal_window_open":
            raise gl.vm.UserError("Appeal window is not open")
        if basis not in valid_bases:
            raise gl.vm.UserError("Invalid appeal basis")
        if len(statement) < 20:
            raise gl.vm.UserError("Appeal statement must be at least 20 chars")

        urls = json.loads(evidence_urls)
        if not isinstance(urls, list):
            raise gl.vm.UserError("Evidence URLs must be a JSON list")

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
        if not raw_r:
            raise gl.vm.UserError("Round not found")
        r = json.loads(raw_r)
        if r["buyer"] != str(gl.message.sender_address):
            raise gl.vm.UserError("Only buyer can request appeal review")
        if r["status"] != "appeal_under_review":
            raise gl.vm.UserError("No appeal is under review")

        raw_appeal = self.appeals.get(round_key, "")
        if not raw_appeal:
            raise gl.vm.UserError("No appeal found")
        appeal = json.loads(raw_appeal)

        raw_eval = self.evaluations.get(round_key, "")
        if not raw_eval:
            raise gl.vm.UserError("No evaluation found")
        original_eval = json.loads(raw_eval)

        bids_text = self._build_bids_text(r["bid_ids"])
        _r = r

        # Fetch appeal evidence at the outer (leader) level
        appeal_urls = json.loads(appeal.get("evidence_urls", "[]"))
        appeal_evidence = []
        for url in appeal_urls[:3]:
            try:
                content = gl.nondet.web_scrape(url)
                if hasattr(content, 'text'):
                    text = str(content.text)[:600]
                else:
                    text = str(content)[:600]
                appeal_evidence.append(f"URL: {url}\n{text}")
            except Exception:
                appeal_evidence.append(f"URL: {url}\n[fetch failed]")
        appeal_evidence_block = (
            "\n---\n".join(appeal_evidence)
            if appeal_evidence else "[no appeal evidence fetched]"
        )

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
            f"Basis: {appeal['basis']}\nStatement: {appeal['statement']}\n\n"
            f"Evidence fetched from appeal URLs:\n{appeal_evidence_block}\n\n"
            f"ALL SUBMITTED BIDS:\n{bids_text}\n\n"
            "Does the appeal introduce meaningful evidence that was overlooked or misread? "
            "Should the recommendation change?\n\n"
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

            if data.get("appeal_verdict") not in ("appeal_granted", "appeal_rejected", "manual_review_required"):
                return False
            if not isinstance(data.get("final_recommendation_changed"), bool):
                return False
            confidence = data.get("confidence")
            if not isinstance(confidence, int) or confidence < 0 or confidence > 100:
                return False

            # If the appeal grants a new winner, that bid must exist in this round
            if data.get("final_recommendation_changed", False):
                new_id = data.get("new_recommended_bid_id")
                if new_id not in _r["bid_ids"]:
                    return False

            # Independent cross-check of the appeal's merit
            val_prompt = (
                "You are an independent appeal validator for a procurement protocol.\n\n"
                f"Round: {_r['title']}\n"
                f"Original verdict: {original_eval['verdict']} — Bid {original_eval['recommended_bid_id']}\n"
                f"Appeal basis: {appeal['basis']}\n"
                f"Appeal statement: {appeal['statement']}\n\n"
                f"Evidence fetched:\n{appeal_evidence_block}\n\n"
                f"All bids:\n{bids_text}\n\n"
                "Does this appeal introduce substantive evidence that changes the outcome?\n"
                'Reply with ONLY valid JSON: {"upheld": true or false}'
            )
            try:
                val_result = gl.nondet.exec_prompt(val_prompt, response_format='json')
                if not isinstance(val_result, dict):
                    return False
                leader_upheld = data.get("appeal_verdict") == "appeal_granted"
                validator_upheld = bool(val_result.get("upheld", False))
                if leader_upheld != validator_upheld:
                    return False
            except Exception:
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
            new_bid_raw = self.bids.get(str(original_eval["recommended_bid_id"]), "")
            if new_bid_raw:
                new_bid = json.loads(new_bid_raw)
                original_eval["recommended_supplier"] = new_bid["supplier"]
            original_eval["verdict"] = "award_recommended"
            self.evaluations[round_key] = json.dumps(original_eval)

        r["status"] = "recommendation_issued"
        self.rounds[round_key] = json.dumps(r)

    @gl.public.write
    def finalize_recommendation(self, round_id: u256) -> None:
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        if not raw:
            raise gl.vm.UserError("Round not found")
        r = json.loads(raw)
        # Anyone can finalize once the recommendation is issued and the appeal
        # window has closed (status = recommendation_issued). The contract
        # determines the recipient automatically — the caller cannot influence
        # where the escrow goes.
        if r["status"] != "recommendation_issued":
            raise gl.vm.UserError("Round is not ready to finalize: appeal window may still be open or round is in an earlier state")

        raw_eval = self.evaluations.get(key, "")
        if not raw_eval:
            raise gl.vm.UserError("No evaluation found")
        eval_data = json.loads(raw_eval)

        # Read escrow → zero it → save state → then transfer (reentrancy-safe ordering)
        locked = self._get_escrow(r)
        buyer = r["buyer"]
        winner_address = str(eval_data.get("recommended_supplier", ""))
        award = eval_data.get("verdict") == "award_recommended"

        r["status"] = "finalized"
        r["finalized"] = True
        self._set_escrow(r, u256(0))
        self.rounds[key] = json.dumps(r)

        if locked > u256(0):
            if award and winner_address:
                _send_gen(winner_address, locked)
            else:
                _send_gen(buyer, locked)

    # ── View methods ──────────────────────────────────────────────────────────

    @gl.public.view
    def get_round(self, round_id: u256) -> str:
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        if not raw:
            raise gl.vm.UserError("Round not found")
        return raw

    @gl.public.view
    def get_bid(self, bid_id: u256) -> str:
        key = str(int(bid_id))
        raw = self.bids.get(key, "")
        if not raw:
            raise gl.vm.UserError("Bid not found")
        return raw

    @gl.public.view
    def get_round_bids(self, round_id: u256) -> str:
        key = str(int(round_id))
        raw = self.rounds.get(key, "")
        if not raw:
            raise gl.vm.UserError("Round not found")
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
                    "escrow_deposited": r.get("escrow_deposited", "0"),
                })
        return json.dumps(result)

    @gl.public.view
    def get_rounds_by_buyer(self, buyer_address: str) -> str:
        result = []
        counter = int(self.round_counter)
        needle = buyer_address.lower()
        for i in range(1, counter + 1):
            raw = self.rounds.get(str(i), "")
            if raw:
                r = json.loads(raw)
                if r["buyer"].lower() == needle:
                    result.append({
                        "round_id": r["round_id"],
                        "title": r["title"],
                        "category": r["category"],
                        "status": r["status"],
                        "bid_deadline": r["bid_deadline"],
                        "created_at": r["created_at"],
                        "finalized": r["finalized"],
                        "bid_count": len(r["bid_ids"]),
                        "escrow_deposited": r.get("escrow_deposited", "0"),
                    })
        return json.dumps(result)

    @gl.public.view
    def get_bids_by_supplier(self, supplier_address: str) -> str:
        result = []
        counter = int(self.bid_counter)
        needle = supplier_address.lower()
        for i in range(1, counter + 1):
            raw = self.bids.get(str(i), "")
            if raw:
                b = json.loads(raw)
                if b["supplier"].lower() == needle:
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
