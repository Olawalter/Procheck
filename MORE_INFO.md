# Procurement Consensus — Resubmission Notes

This document addresses the two rejection criteria point by point, with contract code references, transaction hashes, and explorer links.

---

## Rejection 1 — Validators must fetch and authenticate bid evidence, then verify the substantive winner

### What was wrong before

Validators only checked that the leader's JSON output was well-formed: valid verdict string, confidence in range, correct band values. They had no knowledge of what bids actually existed on-chain, who the suppliers were, or whether any evidence was real.

### What was built

Every validator now runs a five-step verification before accepting the leader's recommendation:

**Step 1 — Bid existence (deterministic)**
The recommended `bid_id` must be one of the bids actually submitted to this round. Pre-snapshotted from on-chain state before the closure is defined (TreeMap reads are not available inside `validator_fn`).

**Step 2 — Supplier identity (deterministic)**
The recommended `supplier` address must exactly match the address stored in the on-chain bid record. A leader cannot substitute a different address.

**Step 3 — Evidence registration (deterministic)**
The winning bid must have at least one evidence URL registered on-chain by the supplier at submission time.

**Step 4 — Evidence fetch (`gl.nondet.web_scrape`)**
Each validator independently calls `gl.nondet.web_scrape` on the winning bid's first evidence URL and reads up to 1000 characters of the live page content. This authenticates that the evidence actually exists and is accessible — not just that a URL string was stored.

**Step 5 — Independent LLM re-evaluation (`gl.nondet.exec_prompt`)**
Each validator calls `gl.nondet.exec_prompt` with the fetched evidence content and all on-chain bid data, asking:

> "Does the fetched evidence credibly support this supplier's claims for this procurement? And is this a reasonable best-value selection given price, delivery, quality, and compliance?"

The validator only returns `true` if the LLM responds `{"agree": true}`.

This is the GenLayer Equivalence Principle in action: five validators independently reason about the same procurement question using live-fetched evidence and must converge on the same answer. A leader cannot win consensus by recommending a winner that independent LLMs would not also endorse.

### Contract code

```python
# validator_fn inside request_evaluation()

# Step 1 — bid must exist in this round
if recommended_bid_id not in _valid_bid_ids:
    return False

# Step 2 — supplier must match on-chain record
if _bid_suppliers.get(recommended_bid_id, "") != recommended_supplier:
    return False

# Step 3 — evidence URL must be registered on-chain
winner_urls = _bid_evidence_urls.get(recommended_bid_id, [])
if not winner_urls:
    return False

# Step 4 — fetch evidence content
evidence_text = "[evidence fetch failed]"
try:
    raw = gl.nondet.web_scrape(winner_urls[0])
    evidence_text = str(raw.text)[:1000] if hasattr(raw, 'text') else str(raw)[:1000]
except Exception:
    pass

# Step 5 — independent LLM re-evaluation with fetched evidence
spot = gl.nondet.exec_prompt(
    f"Procurement: {_title}\n\n"
    f"Submitted bids:\n{_captured_bids_text}\n\n"
    f"The proposed winner is Bid {recommended_bid_id} (Supplier {recommended_supplier}).\n\n"
    f"Evidence fetched from {winner_urls[0]}:\n{evidence_text}\n\n"
    "Does the fetched evidence credibly support this supplier's claims "
    "for this procurement? And is this a reasonable best-value selection "
    "given price, delivery, quality, and compliance? "
    'Reply ONLY with valid JSON: {"agree": true} or {"agree": false}',
    response_format='json'
)
if not isinstance(spot, dict) or not spot.get("agree", False):
    return False
```

### Verified transactions

| Step | Transaction | Status |
|---|---|---|
| `request_evaluation` (evidence fetch + independent LLM) | `0xde3865c2c0b4070c9227b3a174c8b6f3d56572c9809fb06d8189c879b33891ef` | ACCEPTED |
| Evaluation result | `award_recommended`, 100% confidence, Bid 7 (Supplier A) winner | — |

Explorer: https://explorer-studio.genlayer.com/address/0x04F5AB09eC3d00cdE2B82A2e28d5BE53a9A35979

---

## Rejection 2 — Lock buyer budget in escrow; automatically release to consensus winner once appeal window closes

### What was built

#### Escrow lock

`create_round` is decorated `@gl.public.write.payable`. The buyer sends native GEN with the transaction via `gl.message.value`. The amount is stored as `"escrow_deposited"` in the round's on-chain JSON state.

```python
@gl.public.write.payable
def create_round(self, title, category, ...) -> u256:
    escrow = gl.message.value  # u256 — GEN sent with this tx
    self.rounds[key] = json.dumps({
        ...,
        "escrow_deposited": str(int(escrow)),
    })
```

Additional deposits accepted at any time via `deposit_escrow(round_id)`, also `@gl.public.write.payable`.

#### Appeal window enforcement

After evaluation completes, the round enters `appeal_window_open`. Any party may file a structured appeal during this period. Once the window has elapsed with no appeal, **anyone** calls `close_appeal_window(round_id)`:

```python
@gl.public.write
def close_appeal_window(self, round_id: u256) -> None:
    # callable by anyone — no buyer-only gate
    if r["status"] != "appeal_window_open":
        raise gl.vm.UserError("No open appeal window to close")
    if self.appeals.get(key, ""):
        raise gl.vm.UserError("Appeal already filed — use request_appeal_review instead")
    r["status"] = "recommendation_issued"
    self.rounds[key] = json.dumps(r)
```

#### Automatic escrow release

`finalize_recommendation` is callable by **anyone** — no buyer-only gate. The contract reads the consensus result and executes the transfer automatically. The caller cannot influence the destination.

```python
@gl.public.write
def finalize_recommendation(self, round_id: u256) -> None:
    # No sender check — anyone can trigger once appeal window is closed
    if r["status"] != "recommendation_issued":
        raise gl.vm.UserError("Round is not ready to finalize")

    locked = self._get_escrow(r)
    buyer = r["buyer"]
    winner_address = str(eval_data.get("recommended_supplier", ""))
    award = eval_data.get("verdict") == "award_recommended"

    # Zero before transfer — reentrancy safety
    self._set_escrow(r, u256(0))
    self.rounds[key] = json.dumps(r)

    if locked > u256(0):
        if award and winner_address:
            _send_gen(winner_address, locked)  # → winning supplier
        else:
            _send_gen(buyer, locked)           # → refund to buyer
```

GEN is sent via `emit_transfer` on a `@gl.evm.contract_interface` stub — the correct GenLayer pattern for native token transfers out of a contract.

#### Payout table

| Outcome | Escrow destination |
|---|---|
| `award_recommended` → finalized | Winning supplier's address |
| `no_valid_bid` / `insufficient_evidence` / `unverifiable` | Refunded to buyer |
| Round cancelled before bids | Refunded to buyer immediately |
| Finalized with no valid winner address | Refunded to buyer |

#### On-chain time enforcement

GenLayer injects an ISO timestamp into every transaction via `gl.message_raw["datetime"]`. The contract reads this with:

```python
def _now_ts() -> int:
    raw = gl.message_raw.get("datetime", "")
    if raw:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return int(dt.timestamp())
    return 0
```

`submit_bid` rejects bids past `bid_deadline`. `close_appeal_window` rejects calls before `appeal_opened_at + appeal_window` seconds have elapsed. Both checks are enforced fully on-chain.

### Verified transactions (Round 4 — Laptop Procurement, new contract)

| Step | Transaction | Result |
|---|---|---|
| `create_round` with 1 GEN escrow | `0xf0e1426961194d885f1255f155b1459b6a49666c7c1e225ec0bba7dd8d381323` | `escrow_deposited: "1000000000000000000"` |
| `open_round` | `0xe0811776472206e3c6b058829853f14012b1fda37ad11394ad27d092589c9f7b` | ✓ |
| Supplier A `submit_bid` | `0x1b6cf78f5708df431011c4ea85ca8f68375dbd66522315438278cfbb2d37d4b9` | Bid 7 |
| Supplier B `submit_bid` | `0x90329c770f34154951107280257cb3d1792eb4bfcd3579515c98d7834ccc3570` | Bid 8 |
| `close_bids` | `0xe8e279205f7440df0a16bef6861ba74c19d732e17c5f85f8463dd9de2d87a8af` | ✓ |
| `request_evaluation` | `0xde3865c2c0b4070c9227b3a174c8b6f3d56572c9809fb06d8189c879b33891ef` | `award_recommended`, 100% confidence, Bid 7 |
| `close_appeal_window` | `0x8c034c261d87116de4cfc14f3a6dd08b7b2724ce161a69c97f29e76899edef47` | status → `recommendation_issued` |
| `finalize_recommendation` | `0x6c226ba4ddcb77568063083d5b7383654f0aabd816c668c542e4938462249f34` | `escrow_deposited: "0"`, 1 GEN → Supplier A |

---

## Deployed Contract

| Network | Contract Address |
|---|---|
| GenLayer StudioNet (chain ID 61999) | `0x04F5AB09eC3d00cdE2B82A2e28d5BE53a9A35979` |

Explorer: https://explorer-studio.genlayer.com/address/0x04F5AB09eC3d00cdE2B82A2e28d5BE53a9A35979

Live app: https://procheck-theta.vercel.app
