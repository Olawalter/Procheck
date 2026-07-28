# Reply to Team Review

This document addresses each requirement from the team review point by point, with contract code references, test coverage, and verified transactions.

Contract: `0x04F5AB09eC3d00cdE2B82A2e28d5BE53a9A35979` (GenLayer StudioNet, chain ID 61999)  
Explorer: https://explorer-studio.genlayer.com/address/0x04F5AB09eC3d00cdE2B82A2e28d5BE53a9A35979  
Live app: https://procheck-theta.vercel.app  
Test suite: `tests/direct/test_procurement.py` — 56/56 passing

---

## 1. Enforce bid deadlines

**Requirement:** Reject bids submitted after the buyer's stated deadline.

**What was built:**

`create_round` accepts a `bid_deadline` parameter (Unix timestamp). Every `submit_bid` call reads the VM's injected timestamp via `gl.message_raw["datetime"]` and compares it to the stored deadline:

```python
def _now_ts() -> int:
    raw = gl.message_raw.get("datetime", "")
    if raw:
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return int(dt.timestamp())
        except Exception:
            pass
    return 0

# inside submit_bid()
if _now_ts() > int(r["bid_deadline"]):
    raise gl.vm.UserError("Bid deadline has passed")
```

The timestamp is injected by GenVM into every transaction's message context, making it a verifiable on-chain value — not a client-supplied parameter.

**Tests:** `TestDeadlineEnforcement::test_submit_bid_after_deadline_rejected`, `test_submit_bid_before_deadline_accepted`

---

## 2. Enforce appeal window time-lock

**Requirement:** Prevent the appeal window from closing before the defined duration has elapsed.

**What was built:**

When `request_evaluation` completes and the round enters `appeal_window_open`, the contract stores the exact timestamp:

```python
r["appeal_opened_at"] = _now_ts()
```

`close_appeal_window` then checks that the full `appeal_window` duration (in seconds, set at round creation) has elapsed before allowing closure:

```python
def close_appeal_window(self, round_id: u256) -> None:
    appeal_opened_at = int(r.get("appeal_opened_at", 0))
    appeal_window = int(r.get("appeal_window", 86400))
    if _now_ts() < appeal_opened_at + appeal_window:
        raise gl.vm.UserError("Appeal window has not elapsed yet")
```

The window cannot be closed early regardless of who calls it.

**Tests:** `TestDeadlineEnforcement::test_close_appeal_window_before_elapsed_rejected`, `test_close_appeal_window_after_elapsed_succeeds`, `test_appeal_opened_at_stored_on_evaluation`

---

## 3. Validators verify the substantive winner

**Requirement:** Validators must independently confirm the recommended winner — not just check that the leader's JSON is well-formed.

**What was built:**

`validator_fn` inside `request_evaluation` runs a five-step check:

**Step 1 — Bid existence:** The recommended `bid_id` must be in the set of bids actually submitted to this round (pre-snapshotted before the closure, since TreeMap reads are unavailable inside `validator_fn`).

**Step 2 — Supplier identity:** The recommended `supplier` address must exactly match the address stored in the on-chain bid record.

**Step 3 — Evidence registration:** The winning bid must have at least one evidence URL registered on-chain at submission time.

**Step 4 — Evidence fetch:** Each validator independently calls `gl.nondet.web_scrape` on the winning bid's first evidence URL, confirming the evidence exists and is accessible.

**Step 5 — Independent LLM re-evaluation:** Each validator calls `gl.nondet.exec_prompt` with the fetched evidence and all on-chain bid data, asking whether the evidence credibly supports the supplier's claims and whether the selection is a reasonable best-value choice. Returns `true` only if the LLM responds `{"agree": true}`.

```python
# Step 2 — supplier must match on-chain record
if _bid_suppliers.get(recommended_bid_id, "") != recommended_supplier:
    return False

# Step 4 — fetch live evidence
raw = gl.nondet.web_scrape(winner_urls[0])
evidence_text = str(raw.text)[:1000] if hasattr(raw, 'text') else str(raw)[:1000]

# Step 5 — independent LLM re-evaluation
spot = gl.nondet.exec_prompt(
    f"...Does the fetched evidence credibly support this supplier's claims?...",
    response_format='json'
)
if not isinstance(spot, dict) or not spot.get("agree", False):
    return False
```

Similarly, `request_appeal_review` has its own `appeal_validator_fn` that verifies the appeal winner's supplier address matches the on-chain bid record before accepting the leader's appeal outcome.

**Tests:** `TestValidatorGuards` — 10 tests covering invalid bid ID, supplier mismatch, missing evidence, and correct acceptance path.

---

## 4. Bind escrow payout to on-chain bid record

**Requirement:** The escrow release must be tied to the explicit on-chain procurement terms — not to an address the leader can freely specify.

**What was built:**

At `finalize_recommendation`, the contract re-reads the winning `bid_id` from the consensus result, then looks up the supplier address from the on-chain bid record stored at submission time. The leader's `recommended_supplier` field is cross-checked against that stored address; if they differ, the round is treated as no valid winner and the escrow is refunded to the buyer.

```python
# finalize_recommendation()
recommended_bid_id = eval_data.get("recommended_bid_id")
if recommended_bid_id:
    bid_key = f"bid:{round_id}:{recommended_bid_id}"
    stored_bid = self.bids.get(bid_key, "")
    if stored_bid:
        bid_data = json.loads(stored_bid)
        winner_address = bid_data.get("supplier", "").lower()

# Cross-check leader's claim against on-chain record
leader_supplier = str(eval_data.get("recommended_supplier", "")).lower()
if leader_supplier and leader_supplier != winner_address:
    winner_address = ""  # mismatch — treat as no valid winner, refund buyer
```

The escrow destination is always derived from the on-chain bid record, never from an unchecked leader-supplied string.

**Tests:** `TestEscrowTransfers` — 5 tests covering release to winner, refund on no valid bid, cancel refund, and permissionless finalize.

---

## 5. Runtime tests

**Requirement:** Add tests that verify contract behavior at runtime, not just static structure.

**What was built:**

56 runtime tests across 8 classes, all passing. Tests run against the actual contract logic using `gltest` direct mode, which executes the full Python contract in the GenVM runtime with mocked LLM responses.

| Class | Tests | What it verifies |
|---|---|---|
| `TestCreateRound` | 8 | Round creation, escrow locking, input validation, counter |
| `TestRoundLifecycle` | 10 | Open/bid/close/cancel flows, access control, bid submission guards |
| `TestDeadlineEnforcement` | 6 | Bid deadline rejection past cutoff, appeal window elapsed check, `appeal_opened_at` stored on evaluation |
| `TestEvaluation` | 5 | LLM evaluation with mocked response, result storage, no-valid-bid refund |
| `TestEscrowTransfers` | 5 | Escrow released to winner, refunded on no-valid-bid, cancel refund, permissionless finalize |
| `TestAppealFlow` | 5 | Appeal filing, granted/rejected outcomes, outside-window rejection, invalid basis rejection |
| `TestValidatorGuards` | 10 | Deterministic checks inside `validator_fn` |
| `TestProfileLookup` | 7 | Case-insensitive buyer/supplier address matching |

Run with:

```bash
pytest tests/direct/test_procurement.py -v
```

---

## Summary

| Requirement | Status | Key commit |
|---|---|---|
| Bid deadlines enforced | Done | `14a3453` |
| Appeal window time-lock | Done | `14a3453` |
| Validators verify substantive winner | Done | `14a3453` |
| Escrow bound to on-chain bid | Done | `14a3453` |
| Runtime test suite | Done (56/56) | `14a3453` |
| New deployment | Done | `d141336` |
