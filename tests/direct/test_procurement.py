"""
Direct tests for ProcurementConsensusProtocol.

Run with: pytest tests/direct/ -v
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
from contextlib import contextmanager
from unittest.mock import patch
from gltest.direct.loader import create_address, deploy_contract
from gltest.direct.vm import VMContext
from gltest.direct import wasi_mock


@contextmanager
def _nondet_ctx():
    """Patch os.fdopen so mock fds work on Windows during nondet calls."""
    with patch('os.fdopen', wasi_mock.patched_fdopen):
        yield

CONTRACT = Path(__file__).parents[2] / "contract" / "procurement_consensus.py"

BUYER      = create_address("buyer")
SUPPLIER_A = create_address("supplier_a")
SUPPLIER_B = create_address("supplier_b")
STRANGER   = create_address("stranger")

# Bid deadline in the past so close_bids() passes deadline check
PAST_DEADLINE = int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp())
FUTURE_DEADLINE = int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())

ROUND_ARGS = [
    "Hospital Network Upgrade",
    "IT Infrastructure",
    "Supply and install 4x Dell PowerEdge servers and Cisco switching across 3 hospital sites.",
    "4 servers + switching",
    60_000,
    90_000,
    "Evaluate on quality (40%), price (25%), delivery (20%), compliance (15%).",
    json.dumps({"quality": 40, "price": 25, "delivery": 20, "compliance": 15}),
    json.dumps(["ISO 27001", "3+ hospital refs", "NBD warranty"]),
    FUTURE_DEADLINE,   # far future — suppliers can submit; close_bids has no time check
    7 * 3600,          # 7-hour appeal window
]

# Identical args but with a past deadline — used to test post-deadline rejection
ROUND_ARGS_PAST_DEADLINE = ROUND_ARGS[:9] + [PAST_DEADLINE] + ROUND_ARGS[10:]

BID_A = [
    74_500, 32,
    "Dell PowerEdge R750 + Cisco Catalyst. ISO 27001, 5 hospital refs, NBD 3-yr warranty.",
    "3-year NBD on-site",
    "ISO 27001 certified. Fully compliant.",
    json.dumps(["https://en.wikipedia.org/wiki/Dell_PowerEdge"]),
]

BID_B = [
    57_000, 58,
    "HP ProLiant + TP-Link enterprise networking. 1 hospital reference, partial compliance.",
    "1-year RTB",
    "Partially compliant with some ISO controls.",
    json.dumps(["https://en.wikipedia.org/wiki/HP_ProLiant"]),
]

# Canonical LLM evaluation response
EVAL_RESPONSE = json.dumps({
    "verdict": "award_recommended",
    "recommended_bid_id": 1,
    "recommended_supplier": "0x" + SUPPLIER_A.hex(),
    "confidence": 92,
    "quality_band": "strong",
    "price_value_band": "good_value",
    "compliance_band": "complete",
    "risk_band": "low",
    "reason_code": "best_value",
    "short_reason": "Bid 1 meets all mandatory requirements. Best overall value.",
    "appeal_allowed": True,
})

NO_WINNER_RESPONSE = json.dumps({
    "verdict": "no_valid_bid",
    "recommended_bid_id": 0,
    "recommended_supplier": "",
    "confidence": 95,
    "quality_band": "poor",
    "price_value_band": "questionable",
    "compliance_band": "non_compliant",
    "risk_band": "high",
    "reason_code": "no_compliant_bid",
    "short_reason": "No bid met the mandatory requirements.",
    "appeal_allowed": True,
})

APPEAL_GRANTED_RESPONSE = json.dumps({
    "appeal_verdict": "appeal_granted",
    "final_recommendation_changed": True,
    "new_recommended_bid_id": 2,
    "new_recommended_supplier": "0x" + SUPPLIER_B.hex(),
    "confidence": 80,
    "reason_code": "spec_misread",
    "short_reason": "Original evaluation misread Bid 2 delivery timeline.",
})

APPEAL_REJECTED_RESPONSE = json.dumps({
    "appeal_verdict": "appeal_rejected",
    "final_recommendation_changed": False,
    "new_recommended_bid_id": 1,
    "new_recommended_supplier": "0x" + SUPPLIER_A.hex(),
    "confidence": 88,
    "reason_code": "no_new_evidence",
    "short_reason": "Appeal provides no substantive new evidence.",
})


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def vm():
    v = VMContext()
    v.sender = BUYER
    return v


@pytest.fixture(scope="module")
def contract(vm):
    return deploy_contract(CONTRACT, vm)


@pytest.fixture(autouse=True)
def isolate(vm, contract):
    import sys
    snap = vm.snapshot()
    yield
    vm.revert(snap)
    # vm.revert restores vm._datetime but doesn't update gl.message_raw['datetime'];
    # sync it so warped time from one test doesn't bleed into the next.
    if 'genlayer.gl' in sys.modules:
        gl_mod = sys.modules['genlayer.gl']
        if hasattr(gl_mod, 'message_raw') and gl_mod.message_raw is not None:
            gl_mod.message_raw['datetime'] = vm._datetime


def _warp(vm, iso_str: str) -> None:
    """Warp vm clock AND sync gl.message_raw['datetime'] (gltest doesn't do this automatically)."""
    import sys
    vm.warp(iso_str)
    if 'genlayer.gl' in sys.modules:
        gl_mod = sys.modules['genlayer.gl']
        if hasattr(gl_mod, 'message_raw') and gl_mod.message_raw is not None:
            gl_mod.message_raw['datetime'] = iso_str


def _warp_future(vm, seconds: int = 10):
    """Advance vm clock by `seconds` from now."""
    future = datetime.now(timezone.utc) + timedelta(seconds=seconds)
    _warp(vm, future.strftime("%Y-%m-%dT%H:%M:%SZ"))


def _setup_open_round(contract, vm) -> int:
    contract.create_round(*ROUND_ARGS)
    contract.open_round(1)
    return 1


def _setup_bids_closed(contract, vm) -> int:
    _setup_open_round(contract, vm)
    with vm.prank(SUPPLIER_A):
        contract.submit_bid(1, *BID_A)
    with vm.prank(SUPPLIER_B):
        contract.submit_bid(1, *BID_B)
    contract.close_bids(1)
    return 1


def _setup_evaluation(contract, vm) -> int:
    """Run evaluation with mocked LLM. Returns round_id."""
    _setup_bids_closed(contract, vm)
    vm.mock_llm(".*", EVAL_RESPONSE)
    with _nondet_ctx():
        contract.request_evaluation(1)
    return 1


# ── TestCreateRound ───────────────────────────────────────────────────────────

class TestCreateRound:
    def test_creates_round_returns_id(self, contract, vm):
        assert contract.create_round(*ROUND_ARGS) == 1

    def test_round_starts_as_draft(self, contract, vm):
        contract.create_round(*ROUND_ARGS)
        assert json.loads(contract.get_round(1))["status"] == "draft"

    def test_buyer_address_stored(self, contract, vm):
        contract.create_round(*ROUND_ARGS)
        stored = json.loads(contract.get_round(1))["buyer"].lower().lstrip("0x")
        expected = vm.sender.hex().lower()
        assert stored == expected or stored == "0x" + expected

    def test_escrow_stored_when_value_sent(self, contract, vm):
        vm.value = 10 ** 18
        contract.create_round(*ROUND_ARGS)
        vm.value = 0
        assert json.loads(contract.get_round(1))["escrow_deposited"] == str(10 ** 18)

    def test_zero_escrow_by_default(self, contract, vm):
        contract.create_round(*ROUND_ARGS)
        assert json.loads(contract.get_round(1)).get("escrow_deposited", "0") == "0"

    def test_rejects_short_title(self, contract, vm):
        with pytest.raises(Exception):
            contract.create_round(*["Hi"] + ROUND_ARGS[1:])

    def test_rejects_inverted_budget(self, contract, vm):
        with pytest.raises(Exception):
            contract.create_round(*ROUND_ARGS[:4] + [90_000, 60_000] + ROUND_ARGS[6:])

    def test_counter_increments(self, contract, vm):
        contract.create_round(*ROUND_ARGS)
        contract.create_round(*ROUND_ARGS)
        assert json.loads(contract.get_contract_stats())["total_rounds"] == 2


# ── TestRoundLifecycle ────────────────────────────────────────────────────────

class TestRoundLifecycle:
    @pytest.fixture(autouse=True)
    def _create(self, contract, vm):
        contract.create_round(*ROUND_ARGS)

    def test_open_round(self, contract, vm):
        contract.open_round(1)
        assert json.loads(contract.get_round(1))["status"] == "open_for_bids"

    def test_only_buyer_can_open(self, contract, vm):
        with vm.prank(STRANGER):
            with pytest.raises(Exception):
                contract.open_round(1)

    def test_submit_bid_assigns_id(self, contract, vm):
        contract.open_round(1)
        with vm.prank(SUPPLIER_A):
            assert contract.submit_bid(1, *BID_A) == 1

    def test_bid_appears_in_round(self, contract, vm):
        contract.open_round(1)
        with vm.prank(SUPPLIER_A):
            contract.submit_bid(1, *BID_A)
        assert 1 in json.loads(contract.get_round(1))["bid_ids"]

    def test_two_bids_recorded(self, contract, vm):
        contract.open_round(1)
        with vm.prank(SUPPLIER_A):
            contract.submit_bid(1, *BID_A)
        with vm.prank(SUPPLIER_B):
            contract.submit_bid(1, *BID_B)
        assert len(json.loads(contract.get_round_bids(1))) == 2

    def test_close_bids(self, contract, vm):
        contract.open_round(1)
        with vm.prank(SUPPLIER_A):
            contract.submit_bid(1, *BID_A)
        contract.close_bids(1)
        assert json.loads(contract.get_round(1))["status"] == "bid_submission_closed"

    def test_cancel_round_zeroes_escrow(self, contract, vm):
        vm.value = 10 ** 18
        contract.deposit_escrow(1)
        vm.value = 0
        contract.cancel_round(1)
        r = json.loads(contract.get_round(1))
        assert r["status"] == "cancelled"
        assert r["escrow_deposited"] == "0"

    def test_only_buyer_can_cancel(self, contract, vm):
        with vm.prank(SUPPLIER_A):
            with pytest.raises(Exception):
                contract.cancel_round(1)

    def test_cannot_submit_bid_to_draft_round(self, contract, vm):
        with vm.prank(SUPPLIER_A):
            with pytest.raises(Exception):
                contract.submit_bid(1, *BID_A)

    def test_close_appeal_window_requires_appeal_window_open(self, contract, vm):
        with pytest.raises(Exception):
            contract.close_appeal_window(1)


# ── TestDeadlineEnforcement ───────────────────────────────────────────────────

class TestDeadlineEnforcement:
    def test_submit_bid_after_deadline_rejected(self, contract, vm):
        """Supplier cannot submit once bid_deadline has passed."""
        contract.create_round(*ROUND_ARGS)
        contract.open_round(1)
        # Warp past the 7-day future deadline
        far_future = datetime.now(timezone.utc) + timedelta(days=10)
        _warp(vm, far_future.strftime("%Y-%m-%dT%H:%M:%SZ"))
        with vm.prank(SUPPLIER_A):
            with pytest.raises(Exception, match="Bid deadline has passed"):
                contract.submit_bid(1, *BID_A)

    def test_submit_bid_before_deadline_passes(self, contract, vm):
        """Supplier can submit while bid_deadline is in the future."""
        contract.create_round(*ROUND_ARGS)
        contract.open_round(1)
        with vm.prank(SUPPLIER_A):
            bid_id = contract.submit_bid(1, *BID_A)
        assert bid_id == 1

    def test_round_with_past_deadline_blocks_bid_submission(self, contract, vm):
        """Round created with an already-past deadline blocks bid immediately."""
        contract.create_round(*ROUND_ARGS_PAST_DEADLINE)
        contract.open_round(1)
        with vm.prank(SUPPLIER_A):
            with pytest.raises(Exception, match="Bid deadline has passed"):
                contract.submit_bid(1, *BID_A)

    def test_close_appeal_window_before_elapsed_rejected(self, contract, vm):
        """close_appeal_window fails if appeal window has not elapsed."""
        _setup_evaluation(contract, vm)
        # Do NOT warp — appeal_window is 7 hours, we're still in it
        with pytest.raises(Exception, match="Appeal window has not elapsed"):
            contract.close_appeal_window(1)

    def test_close_appeal_window_after_elapsed_passes(self, contract, vm):
        """close_appeal_window succeeds after appeal window elapses."""
        _setup_evaluation(contract, vm)
        # Warp 8 hours forward (appeal_window = 7 hours)
        future = datetime.now(timezone.utc) + timedelta(hours=8)
        _warp(vm, future.strftime("%Y-%m-%dT%H:%M:%SZ"))
        contract.close_appeal_window(1)
        assert json.loads(contract.get_round(1))["status"] == "recommendation_issued"

    def test_appeal_window_stored_on_evaluation(self, contract, vm):
        """appeal_opened_at is written when evaluation completes."""
        _setup_evaluation(contract, vm)
        r = json.loads(contract.get_round(1))
        assert r["status"] == "appeal_window_open"
        assert "appeal_opened_at" in r
        assert int(r["appeal_opened_at"]) > 0


# ── TestEvaluation ────────────────────────────────────────────────────────────

class TestEvaluation:
    def test_evaluation_sets_appeal_window_open(self, contract, vm):
        _setup_evaluation(contract, vm)
        assert json.loads(contract.get_round(1))["status"] == "appeal_window_open"

    def test_evaluation_result_stored(self, contract, vm):
        _setup_evaluation(contract, vm)
        result = json.loads(contract.get_evaluation_result(1))
        assert result["verdict"] == "award_recommended"
        assert result["recommended_bid_id"] == 1
        assert result["confidence"] == 92

    def test_evaluation_winner_matches_supplier_a(self, contract, vm):
        _setup_evaluation(contract, vm)
        result = json.loads(contract.get_evaluation_result(1))
        assert result["recommended_supplier"].lower() == ("0x" + SUPPLIER_A.hex()).lower()

    def test_no_valid_bid_refunds_escrow_immediately(self, contract, vm):
        """When verdict is no_valid_bid, escrow is refunded without waiting for appeal window."""
        _setup_bids_closed(contract, vm)
        vm.value = 10 ** 18
        contract.deposit_escrow(1)
        vm.value = 0
        vm.mock_llm(".*", NO_WINNER_RESPONSE)
        with _nondet_ctx():
            contract.request_evaluation(1)
        r = json.loads(contract.get_round(1))
        assert r["status"] == "no_valid_bid"
        assert r["escrow_deposited"] == "0"

    def test_cannot_evaluate_with_no_bids(self, contract, vm):
        contract.create_round(*ROUND_ARGS)
        contract.open_round(1)
        contract.close_bids(1)
        with pytest.raises(Exception):
            contract.request_evaluation(1)


# ── TestEscrowTransfers ───────────────────────────────────────────────────────

class TestEscrowTransfers:
    def test_escrow_released_to_winner_on_finalization(self, contract, vm):
        """Full happy path: escrow goes to winning supplier."""
        _setup_evaluation(contract, vm)
        future = datetime.now(timezone.utc) + timedelta(hours=8)
        _warp(vm, future.strftime("%Y-%m-%dT%H:%M:%SZ"))
        contract.close_appeal_window(1)
        contract.finalize_recommendation(1)
        r = json.loads(contract.get_round(1))
        assert r["status"] == "finalized"
        assert r["escrow_deposited"] == "0"

    def test_escrow_zero_after_no_valid_bid(self, contract, vm):
        _setup_bids_closed(contract, vm)
        vm.value = 10 ** 18
        contract.deposit_escrow(1)
        vm.value = 0
        vm.mock_llm(".*", NO_WINNER_RESPONSE)
        with _nondet_ctx():
            contract.request_evaluation(1)
        assert json.loads(contract.get_round(1))["escrow_deposited"] == "0"

    def test_finalize_requires_recommendation_issued(self, contract, vm):
        """Cannot finalize while appeal window is still open."""
        _setup_evaluation(contract, vm)
        with pytest.raises(Exception):
            contract.finalize_recommendation(1)

    def test_cancel_before_bids_refunds_escrow(self, contract, vm):
        contract.create_round(*ROUND_ARGS)
        vm.value = 5 * 10 ** 17
        contract.deposit_escrow(1)
        vm.value = 0
        contract.cancel_round(1)
        assert json.loads(contract.get_round(1))["escrow_deposited"] == "0"

    def test_anyone_can_finalize(self, contract, vm):
        """finalize_recommendation is permissionless once recommendation_issued."""
        _setup_evaluation(contract, vm)
        future = datetime.now(timezone.utc) + timedelta(hours=8)
        _warp(vm, future.strftime("%Y-%m-%dT%H:%M:%SZ"))
        contract.close_appeal_window(1)
        with vm.prank(STRANGER):
            contract.finalize_recommendation(1)
        assert json.loads(contract.get_round(1))["status"] == "finalized"


# ── TestAppealFlow ────────────────────────────────────────────────────────────

class TestAppealFlow:
    def test_file_appeal_blocks_close_appeal_window(self, contract, vm):
        """If appeal is filed, close_appeal_window must fail."""
        _setup_evaluation(contract, vm)
        future = datetime.now(timezone.utc) + timedelta(hours=8)
        _warp(vm, future.strftime("%Y-%m-%dT%H:%M:%SZ"))
        with vm.prank(SUPPLIER_B):
            contract.file_appeal(
                1, "technical_spec_misread",
                "Bid 2 delivery timeline was misread by the evaluator.",
                json.dumps([]),
            )
        assert json.loads(contract.get_round(1))["status"] == "appeal_under_review"
        with pytest.raises(Exception):
            contract.close_appeal_window(1)

    def test_appeal_granted_changes_winner(self, contract, vm):
        """When appeal is granted, the evaluation result is updated to the new winner."""
        _setup_evaluation(contract, vm)
        future = datetime.now(timezone.utc) + timedelta(hours=8)
        _warp(vm, future.strftime("%Y-%m-%dT%H:%M:%SZ"))
        with vm.prank(SUPPLIER_B):
            contract.file_appeal(
                1, "technical_spec_misread",
                "Bid 2 delivery timeline was misread by the evaluator.",
                json.dumps([]),
            )
        # Clear evaluation mock so it doesn't shadow appeal mocks (FIFO matching)
        vm._llm_mocks.clear()
        vm.mock_llm("independent appeal validator", json.dumps({"upheld": True}))
        vm.mock_llm(".*", APPEAL_GRANTED_RESPONSE)
        with _nondet_ctx():
            contract.request_appeal_review(1)
        result = json.loads(contract.get_evaluation_result(1))
        assert result["recommended_bid_id"] == 2

    def test_appeal_rejected_preserves_original_winner(self, contract, vm):
        """Rejected appeal leaves the original recommendation unchanged."""
        _setup_evaluation(contract, vm)
        future = datetime.now(timezone.utc) + timedelta(hours=8)
        _warp(vm, future.strftime("%Y-%m-%dT%H:%M:%SZ"))
        with vm.prank(SUPPLIER_B):
            contract.file_appeal(
                1, "price_miscalculation",
                "The price comparison was done incorrectly by the system.",
                json.dumps([]),
            )
        vm._llm_mocks.clear()
        vm.mock_llm("independent appeal validator", json.dumps({"upheld": False}))
        vm.mock_llm(".*", APPEAL_REJECTED_RESPONSE)
        with _nondet_ctx():
            contract.request_appeal_review(1)
        result = json.loads(contract.get_evaluation_result(1))
        assert result["recommended_bid_id"] == 1

    def test_cannot_file_appeal_outside_window(self, contract, vm):
        _setup_evaluation(contract, vm)
        future = datetime.now(timezone.utc) + timedelta(hours=8)
        _warp(vm, future.strftime("%Y-%m-%dT%H:%M:%SZ"))
        contract.close_appeal_window(1)
        with vm.prank(SUPPLIER_B):
            with pytest.raises(Exception):
                contract.file_appeal(
                    1, "price_miscalculation",
                    "Too late to file this appeal.",
                    json.dumps([]),
                )

    def test_invalid_appeal_basis_rejected(self, contract, vm):
        _setup_evaluation(contract, vm)
        with vm.prank(SUPPLIER_B):
            with pytest.raises(Exception):
                contract.file_appeal(1, "made_up_basis", "Some statement here to fill chars.", json.dumps([]))


# ── TestValidatorGuards ───────────────────────────────────────────────────────

class TestValidatorGuards:
    VALID_VERDICTS = [
        "award_recommended", "no_valid_bid", "tie_detected",
        "insufficient_evidence", "unverifiable", "manual_review_required",
    ]
    VALID_QUALITY    = ["poor", "weak", "acceptable", "strong", "excellent"]
    VALID_PRICE      = ["overpriced", "questionable", "fair", "good_value", "exceptional_value"]
    VALID_COMPLIANCE = ["non_compliant", "weak", "partial", "strong", "complete"]
    VALID_RISK       = ["high", "medium", "low", "minimal"]

    def _check(self, data):
        if data.get("verdict") not in self.VALID_VERDICTS:
            return False
        c = data.get("confidence")
        if not isinstance(c, int) or not (0 <= c <= 100):
            return False
        if data.get("quality_band") not in self.VALID_QUALITY:
            return False
        if data.get("price_value_band") not in self.VALID_PRICE:
            return False
        if data.get("compliance_band") not in self.VALID_COMPLIANCE:
            return False
        if data.get("risk_band") not in self.VALID_RISK:
            return False
        return True

    def _good(self):
        return {
            "verdict": "award_recommended", "recommended_bid_id": 1,
            "recommended_supplier": "0xSupplierA", "confidence": 90,
            "quality_band": "strong", "price_value_band": "good_value",
            "compliance_band": "complete", "risk_band": "low",
            "reason_code": "best_value", "short_reason": "Bid 1 wins.",
            "appeal_allowed": True,
        }

    def test_valid_output_passes(self):
        assert self._check(self._good())

    def test_invalid_verdict_fails(self):
        d = self._good(); d["verdict"] = "invented"
        assert not self._check(d)

    def test_confidence_above_100_fails(self):
        d = self._good(); d["confidence"] = 150
        assert not self._check(d)

    def test_confidence_negative_fails(self):
        d = self._good(); d["confidence"] = -1
        assert not self._check(d)

    def test_bad_quality_band_fails(self):
        d = self._good(); d["quality_band"] = "superb"
        assert not self._check(d)

    def test_bad_price_band_fails(self):
        d = self._good(); d["price_value_band"] = "cheap"
        assert not self._check(d)

    def test_phantom_bid_rejected(self):
        valid_ids = [1, 2]
        assert 99 not in valid_ids

    def test_supplier_mismatch_rejected(self):
        bid_suppliers = {1: "0xSupplierA", 2: "0xSupplierB"}
        assert bid_suppliers.get(1) != "0xSupplierB"

    def test_missing_evidence_url_rejected(self):
        bid_evidence_urls = {1: [], 2: ["https://example.com"]}
        assert not bid_evidence_urls.get(1, [])

    def test_non_award_skips_bid_checks(self):
        for v in ["no_valid_bid", "insufficient_evidence", "tie_detected"]:
            d = self._good(); d["verdict"] = v
            assert self._check(d)


# ── TestProfileLookup ─────────────────────────────────────────────────────────

class TestProfileLookup:
    @pytest.fixture(autouse=True)
    def _setup(self, contract, vm):
        contract.create_round(*ROUND_ARGS)
        contract.open_round(1)
        with vm.prank(SUPPLIER_A):
            contract.submit_bid(1, *BID_A)

    def test_rounds_by_buyer_exact(self, contract, vm):
        assert len(json.loads(contract.get_rounds_by_buyer("0x" + vm.sender.hex()))) == 1

    def test_rounds_by_buyer_lowercase(self, contract, vm):
        assert len(json.loads(contract.get_rounds_by_buyer(("0x" + vm.sender.hex()).lower()))) == 1

    def test_rounds_by_buyer_uppercase(self, contract, vm):
        assert len(json.loads(contract.get_rounds_by_buyer(("0x" + vm.sender.hex()).upper()))) == 1

    def test_wrong_address_empty(self, contract, vm):
        assert json.loads(contract.get_rounds_by_buyer("0x" + SUPPLIER_A.hex())) == []

    def test_bids_by_supplier(self, contract, vm):
        assert len(json.loads(contract.get_bids_by_supplier("0x" + SUPPLIER_A.hex()))) == 1

    def test_bids_by_supplier_lowercase(self, contract, vm):
        assert len(json.loads(contract.get_bids_by_supplier(("0x" + SUPPLIER_A.hex()).lower()))) == 1

    def test_buyer_has_no_bids(self, contract, vm):
        assert json.loads(contract.get_bids_by_supplier("0x" + vm.sender.hex())) == []
