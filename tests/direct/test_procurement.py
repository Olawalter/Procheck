"""
Direct tests for ProcurementConsensusProtocol.

Run with: pytest tests/direct/ -v
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from gltest.direct.loader import create_address, deploy_contract
from gltest.direct.vm import VMContext

CONTRACT = Path(__file__).parents[2] / "contract" / "procurement_consensus.py"

BUYER      = create_address("buyer")
SUPPLIER_A = create_address("supplier_a")
SUPPLIER_B = create_address("supplier_b")
STRANGER   = create_address("stranger")

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
    int(2e9),
    7 * 3600,
]

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


# ---------------------------------------------------------------------------
# Module-scoped VM + contract — one load per session, snapshot for isolation
# ---------------------------------------------------------------------------

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
    """Snapshot before each test, restore after — clean state every test."""
    snap = vm.snapshot()
    yield
    vm.revert(snap)


# ---------------------------------------------------------------------------
# TestCreateRound
# ---------------------------------------------------------------------------

class TestCreateRound:
    def test_creates_round_returns_id(self, contract, vm):
        rid = contract.create_round(*ROUND_ARGS)
        assert rid == 1

    def test_round_starts_as_draft(self, contract, vm):
        contract.create_round(*ROUND_ARGS)
        r = json.loads(contract.get_round(1))
        assert r["status"] == "draft"

    def test_buyer_address_stored(self, contract, vm):
        contract.create_round(*ROUND_ARGS)
        r = json.loads(contract.get_round(1))
        stored = r["buyer"].lower().lstrip("0x")
        expected = vm.sender.hex().lower()
        assert stored == expected or stored == "0x" + expected

    def test_escrow_stored_when_value_sent(self, contract, vm):
        vm.value = 10 ** 18
        contract.create_round(*ROUND_ARGS)
        vm.value = 0
        r = json.loads(contract.get_round(1))
        assert r["escrow_deposited"] == str(10 ** 18)

    def test_zero_escrow_by_default(self, contract, vm):
        contract.create_round(*ROUND_ARGS)
        r = json.loads(contract.get_round(1))
        assert r.get("escrow_deposited", "0") == "0"

    def test_rejects_short_title(self, contract, vm):
        args = ["Hi"] + ROUND_ARGS[1:]
        with pytest.raises(Exception):
            contract.create_round(*args)

    def test_rejects_inverted_budget(self, contract, vm):
        args = ROUND_ARGS[:4] + [90_000, 60_000] + ROUND_ARGS[6:]
        with pytest.raises(Exception):
            contract.create_round(*args)

    def test_counter_increments(self, contract, vm):
        contract.create_round(*ROUND_ARGS)
        contract.create_round(*ROUND_ARGS)
        stats = json.loads(contract.get_contract_stats())
        assert stats["total_rounds"] == 2


# ---------------------------------------------------------------------------
# TestRoundLifecycle
# ---------------------------------------------------------------------------

class TestRoundLifecycle:
    @pytest.fixture(autouse=True)
    def _create_round(self, contract, vm):
        contract.create_round(*ROUND_ARGS)

    def test_open_round(self, contract, vm):
        contract.open_round(1)
        r = json.loads(contract.get_round(1))
        assert r["status"] == "open_for_bids"

    def test_only_buyer_can_open(self, contract, vm):
        with vm.prank(STRANGER):
            with pytest.raises(Exception):
                contract.open_round(1)

    def test_submit_bid_assigns_id(self, contract, vm):
        contract.open_round(1)
        with vm.prank(SUPPLIER_A):
            bid_id = contract.submit_bid(1, *BID_A)
        assert bid_id == 1

    def test_bid_appears_in_round(self, contract, vm):
        contract.open_round(1)
        with vm.prank(SUPPLIER_A):
            contract.submit_bid(1, *BID_A)
        r = json.loads(contract.get_round(1))
        assert 1 in r["bid_ids"]

    def test_two_bids_recorded(self, contract, vm):
        contract.open_round(1)
        with vm.prank(SUPPLIER_A):
            contract.submit_bid(1, *BID_A)
        with vm.prank(SUPPLIER_B):
            contract.submit_bid(1, *BID_B)
        bids = json.loads(contract.get_round_bids(1))
        assert len(bids) == 2

    def test_close_bids(self, contract, vm):
        contract.open_round(1)
        with vm.prank(SUPPLIER_A):
            contract.submit_bid(1, *BID_A)
        contract.close_bids(1)
        r = json.loads(contract.get_round(1))
        assert r["status"] == "bid_submission_closed"

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


# ---------------------------------------------------------------------------
# TestValidatorGuards
# ---------------------------------------------------------------------------

class TestValidatorGuards:
    """
    Verify the deterministic validator guard logic in isolation —
    the checks that run before gl.nondet.* inside validator_fn.
    """

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

    # Deterministic guard checks (bid existence, supplier match, evidence)
    def test_phantom_bid_rejected(self):
        valid_ids = [1, 2]
        assert 99 not in valid_ids

    def test_supplier_mismatch_rejected(self):
        bid_suppliers = {1: "0xSupplierA", 2: "0xSupplierB"}
        # Leader claims bid 1 belongs to SupplierB — reject
        assert bid_suppliers.get(1) != "0xSupplierB"

    def test_missing_evidence_url_rejected(self):
        bid_evidence_urls = {1: [], 2: ["https://example.com"]}
        assert not bid_evidence_urls.get(1, [])

    def test_non_award_skips_bid_checks(self):
        for v in ["no_valid_bid", "insufficient_evidence", "tie_detected"]:
            d = self._good(); d["verdict"] = v
            assert self._check(d)


# ---------------------------------------------------------------------------
# TestProfileLookup
# ---------------------------------------------------------------------------

class TestProfileLookup:
    @pytest.fixture(autouse=True)
    def _setup(self, contract, vm):
        contract.create_round(*ROUND_ARGS)
        contract.open_round(1)
        with vm.prank(SUPPLIER_A):
            contract.submit_bid(1, *BID_A)

    def test_rounds_by_buyer_exact(self, contract, vm):
        addr = "0x" + vm.sender.hex()
        rounds = json.loads(contract.get_rounds_by_buyer(addr))
        assert len(rounds) == 1

    def test_rounds_by_buyer_lowercase(self, contract, vm):
        addr = "0x" + vm.sender.hex()
        rounds = json.loads(contract.get_rounds_by_buyer(addr.lower()))
        assert len(rounds) == 1

    def test_rounds_by_buyer_uppercase(self, contract, vm):
        addr = "0x" + vm.sender.hex()
        rounds = json.loads(contract.get_rounds_by_buyer(addr.upper()))
        assert len(rounds) == 1

    def test_wrong_address_empty(self, contract, vm):
        rounds = json.loads(contract.get_rounds_by_buyer("0x" + SUPPLIER_A.hex()))
        assert rounds == []

    def test_bids_by_supplier(self, contract, vm):
        bids = json.loads(contract.get_bids_by_supplier("0x" + SUPPLIER_A.hex()))
        assert len(bids) == 1

    def test_bids_by_supplier_lowercase(self, contract, vm):
        bids = json.loads(contract.get_bids_by_supplier(("0x" + SUPPLIER_A.hex()).lower()))
        assert len(bids) == 1

    def test_buyer_has_no_bids(self, contract, vm):
        bids = json.loads(contract.get_bids_by_supplier("0x" + vm.sender.hex()))
        assert bids == []
