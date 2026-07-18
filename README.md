# Procurement Consensus

**GenLayer-powered bid evaluation that awards the best-value proposal — not the cheapest one.**

> Live: https://procheck-theta.vercel.app  
> Contact: walterolaolu@gmail.com

---

## The Problem

Procurement is one of the most corruption-prone processes in the world — not because buyers are dishonest, but because the tools they use are. Traditional smart contracts can only compare numbers. They cannot read a technical proposal, assess whether a warranty is credible, judge if a supplier's delivery timeline is realistic, or weigh five competing criteria against each other.

The result? Contracts go to the cheapest bidder. And the cheapest bidder is rarely the best value.

**Procurement Consensus fixes this** by bringing GenLayer validators into the evaluation loop. Instead of arithmetic, you get reasoning. Instead of the lowest number, you get the best-value recommendation — transparent, on-chain, and auditable by anyone.

---

## What It Does

Procurement Consensus is a full-stack dApp built on GenLayer StudioNet. Buyers create procurement rounds with weighted evaluation criteria, accept structured bids from suppliers, then trigger a validator consensus evaluation that produces a canonical award recommendation.

The entire lifecycle — round creation, bid submission, evaluation, appeal, finalization — is on-chain.

**Core flow:**

1. Buyer creates a round with title, category, budget range, criteria weights (e.g. 40% quality, 25% price, 20% delivery, 15% compliance), mandatory requirements, and a bid deadline
2. Suppliers submit bid packets: price, delivery timeline, technical summary, warranty terms, compliance statement, and evidence URLs
3. Buyer closes bids and requests evaluation
4. GenLayer validators independently evaluate all bids against the criteria and reach consensus on the best-value bid
5. The result is a canonical JSON recommendation with verdict, confidence score, quality/price/compliance/risk bands, and a plain-English reason
6. Any party can file a structured appeal during the appeal window
7. Buyer finalizes the recommendation on-chain

---

## Why GenLayer Is the Right Tool

Normal smart contracts can only ask: **who is cheapest?**

Procurement Consensus asks: **which bid provides the best overall value under the stated criteria?**

That question requires reading and interpreting technical summaries, assessing evidence credibility, weighing delivery risk, judging whether a compliance statement actually satisfies requirements, and making tradeoff decisions between criteria. This is non-deterministic reasoning — it cannot be hard-coded.

GenLayer validators handle it through `gl.nondet.exec_prompt`, where each validator independently evaluates the bids and the Equivalence Principle determines consensus across their outputs.

---

## Substantive Validator Verification

A common failure mode in on-chain AI evaluation is that validators only check whether the output looks correct (is the JSON well-formed? are the band values valid?) without checking whether the conclusion itself is sound.

Procurement Consensus addresses this at two levels:

### Leader: evidence-aware LLM evaluation

The leader node runs `gl.nondet.exec_prompt` with a full evaluation prompt that includes each bid's evidence URLs, technical summary, warranty terms, compliance statement, price, and delivery timeline. The LLM is asked to reason about whether the evidence links are credible for the procurement category — not just to pick the lowest price. The bid data is embedded in the prompt directly from on-chain storage, so the leader cannot silently substitute or omit bids.

### Validators: substantive on-chain consistency checks

When a leader recommends a winner, each independent validator performs three deterministic checks against the on-chain state:

1. **Bid existence** — the `recommended_bid_id` must be one of the bids actually submitted to this round (not a phantom ID the leader fabricated)
2. **Supplier identity** — the `recommended_supplier` address must exactly match the address recorded in the on-chain bid (not just whatever the leader claimed)
3. **Evidence registration** — the winning bid must have at least one evidence URL on-chain, confirming the leader had real, supplier-registered evidence to evaluate

If any of these checks fail, the validator rejects the result and consensus fails. This means a leader cannot recommend a phantom bid, substitute a different supplier address, or award a bid with no evidence on record — even if the JSON structure looks perfect.

The division of labour is intentional: the leader does the expensive evidence fetch and reasoning; validators confirm the output is consistent with immutable on-chain facts. This pattern keeps consensus fast and reliable while still enforcing substantive correctness.

---

## GEN Escrow Integration

Buyers can lock GEN onchain with each procurement round. The escrow is held by the contract and released automatically:

| Outcome | What happens to the escrow |
|---|---|
| `award_recommended` → buyer finalizes | Transferred to the winning supplier's address |
| `no_valid_bid` / `insufficient_evidence` / `unverifiable` | Refunded to buyer automatically |
| Round cancelled (before any bids) | Refunded to buyer immediately |
| Buyer finalizes with no valid winner | Refunded to buyer |

**How to deposit escrow:**

1. On the Create Round page, enter a whole GEN amount in the **GEN Escrow** field — it is sent as native value with the `create_round` transaction
2. Alternatively, call `deposit_escrow(round_id)` separately with GEN value to add more after creation

The escrow amount is visible on the round detail page. No manual release is required — finalization triggers the transfer automatically.

---

## The Equivalence Principle in Procurement

Procurement judgement is inherently qualitative. Two validators may write different reasoning but reach the same procurement conclusion. Procurement Consensus accounts for this by requiring validators to express their verdict in structured bands rather than free text:

| Field | Values |
|---|---|
| `verdict` | `award_recommended`, `no_valid_bid`, `tie_detected`, `insufficient_evidence`, `manual_review_required` |
| `quality_band` | `poor`, `weak`, `acceptable`, `strong`, `excellent` |
| `price_value_band` | `overpriced`, `questionable`, `fair`, `good_value`, `exceptional_value` |
| `compliance_band` | `non_compliant`, `weak`, `partial`, `strong`, `complete` |
| `risk_band` | `high`, `medium`, `low`, `minimal` |
| `confidence` | 0–100 integer |

Two validators that agree on all bands and the recommended bid are equivalent — even if their internal reasoning differs. This makes non-deterministic procurement evaluation provably convergent.

---

## Canonical Evaluation Output

```json
{
  "verdict": "award_recommended",
  "recommended_bid_id": 2,
  "recommended_supplier": "0x...",
  "confidence": 87,
  "quality_band": "strong",
  "price_value_band": "good_value",
  "compliance_band": "complete",
  "risk_band": "low",
  "reason_code": "best_value_not_lowest_price",
  "short_reason": "Bid 2 provides the strongest balance of specification fit, fair price, delivery reliability, and complete compliance evidence.",
  "appeal_allowed": true
}
```

---

## Appeal System

After evaluation, any party can file a structured appeal with one of eight bases:

- `new_compliance_evidence`
- `price_miscalculation`
- `technical_spec_misread`
- `delivery_timeline_misread`
- `supplier_identity_error`
- `evidence_url_misread`
- `criteria_weighting_error`
- `conflict_of_interest_claim`

GenLayer validators review the appeal against the original evaluation. If the appeal introduces meaningful new information, the recommendation can change. The appeal result is also stored on-chain.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Intelligent Contract | Python, GenLayer SDK (`gl.vm.run_nondet_unsafe`, `gl.nondet.exec_prompt`) |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Chain client | `genlayer-js` |
| Wallet | Injected EVM wallets via EIP-6963 (MetaMask, Rabby, and any compatible wallet) |
| Network | GenLayer StudioNet — chain ID 61999, RPC `https://studio.genlayer.com/api` |

---

## Wallet Architecture

The app uses **EIP-6963** for injected wallet detection — the modern standard that supports multiple wallets installed simultaneously.

**How it works:**

- On load, the app listens for `eip6963:announceProvider` events and collects all available wallet providers
- If **one wallet** is detected, clicking "Connect Wallet" connects directly — no modal
- If **multiple wallets** are detected (e.g. both MetaMask and Rabby), a wallet selection modal appears so the user picks which to use
- If **no wallet** is detected, the modal shows install links for MetaMask and Rabby
- Falls back to `window.ethereum` for wallets that do not yet support EIP-6963
- Persists the selected wallet across page refreshes using `localStorage` (reconnects silently on return if the wallet is already unlocked)
- Listens for `accountsChanged`, `chainChanged`, and `disconnect` events and updates the UI automatically
- Detects wrong network and shows a **Switch Network** button that adds/switches to GenLayer StudioNet automatically

**Supported wallets:** MetaMask, Rabby, and any injected EVM wallet that implements EIP-1193 or EIP-6963.

---

## Project Structure

```
ProCheck/
├── contract/
│   └── procurement_consensus.py       # Intelligent Contract
├── src/
│   ├── app/
│   │   ├── page.tsx                   # Landing page
│   │   ├── layout.tsx
│   │   ├── rounds/
│   │   │   ├── page.tsx               # Bid Board — all rounds
│   │   │   ├── create/page.tsx        # Create procurement round
│   │   │   └── [roundId]/
│   │   │       ├── page.tsx           # Round detail + buyer actions
│   │   │       ├── submit-bid/page.tsx
│   │   │       ├── evaluation/page.tsx
│   │   │       └── appeal/page.tsx
│   │   └── profile/page.tsx           # My rounds + my bids
│   ├── components/
│   │   ├── ui/                        # Button, Badge, Toast
│   │   ├── WalletSelectModal.tsx      # EIP-6963 wallet picker
│   │   ├── Navbar.tsx                 # Connect Wallet + wrong-network banner
│   │   ├── ProcurementRoundCard.tsx
│   │   ├── BidPacketPanel.tsx
│   │   ├── BidComparisonMatrix.tsx
│   │   ├── ConsensusAwardSeal.tsx
│   │   ├── ValueScoreRadar.tsx
│   │   ├── RiskBandMeter.tsx
│   │   ├── ComplianceChecklist.tsx
│   │   ├── CriteriaWeightGrid.tsx
│   │   ├── AwardTrailTimeline.tsx
│   │   ├── AppealDesk.tsx
│   │   └── ExplorerLinkCard.tsx
│   ├── context/
│   │   └── WalletContext.tsx          # EIP-6963 provider detection + connection management
│   ├── lib/
│   │   ├── genlayer.ts                # readContract / writeContract / waitForTransaction
│   │   ├── wallet-types.ts            # EIP-1193 and EIP-6963 TypeScript interfaces
│   │   └── utils.ts
│   └── types/
│       └── index.ts                   # All shared TypeScript types
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A compatible EVM wallet: [MetaMask](https://metamask.io) or [Rabby](https://rabby.io)
- GenLayer CLI: `npm install -g genlayer`

### 1. Deploy the contract

```bash
genlayer deploy contract/procurement_consensus.py --network studionet
```

Copy the contract address from the output.

### 2. Configure environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_CHAIN_NAME=GenLayer StudioNet
NEXT_PUBLIC_CHAIN_ID=61999
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_EXPLORER_URL=https://explorer-studio.genlayer.com
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0x5674DC8536793453b4727544C1ED96FAf3821281
```

### 3. Run the frontend

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Connect your wallet

Click **Connect Wallet** in the navbar. If you are on the wrong network, a banner will appear — click **Switch Network** to add and switch to GenLayer StudioNet automatically (chain ID 61999).

---

## Running the Ambulance Demo

The built-in demo scenario showcases everything: competing bids with different tradeoffs, a non-lowest-price winner, and the reasoning behind it. You need four wallet accounts — one buyer, three suppliers.

**Step 1 — Create the round (Buyer)**
- Title: `Ambulance Fleet Procurement`
- Category: `Medical Transport`
- Budget: 90,000 – 130,000 GEN
- Weights: Quality 40%, Price 25%, Delivery 20%, Compliance 15%

**Step 2 — Submit three competing bids**

| Bid | Price | Signal |
|---|---|---|
| Bid 1 | 85,000 GEN | Cheapest — weak warranty, vague compliance, slow delivery |
| Bid 2 | 112,000 GEN | Strong spec, 45-day delivery, complete warranty and compliance |
| Bid 3 | 127,500 GEN | Strong spec, expensive, only one evidence URL |

**Step 3 — Close bids and request evaluation**

GenLayer validators compare all three bids against the criteria. Takes 30–90 seconds.

**Expected result:** Bid 2 wins — `award_recommended`, reason `best_value_not_lowest_price`

**Step 4 — Optionally file and review an appeal**

**Step 5 — Buyer finalizes the recommendation on-chain**

---

## Contract Methods

### Write (state-changing)

| Method | Description |
|---|---|
| `create_round(...)` | Create a new procurement round |
| `open_round(round_id)` | Open round for bid submissions |
| `close_bids(round_id)` | Close bid window |
| `submit_bid(round_id, ...)` | Submit a bid packet |
| `revise_bid(bid_id, ...)` | Revise your bid before close |
| `request_evaluation(round_id)` | Trigger validator consensus evaluation |
| `finalize_recommendation(round_id)` | Buyer accepts and finalizes the result |
| `cancel_round(round_id)` | Cancel round (buyer only, before bids) — refunds escrow |
| `deposit_escrow(round_id)` | Deposit additional GEN escrow after round creation (payable) |
| `file_appeal(round_id, basis, statement, evidence_urls)` | File a structured appeal |
| `request_appeal_review(round_id)` | Trigger validator appeal review |

### Read (view)

| Method | Returns |
|---|---|
| `get_round(round_id)` | Full round object |
| `get_all_rounds()` | All rounds |
| `get_rounds_by_buyer(address)` | Rounds created by an address |
| `get_round_bids(round_id)` | All bids for a round |
| `get_bids_by_supplier(address)` | Bids submitted by an address |
| `get_evaluation_result(round_id)` | Evaluation result or empty dict |
| `get_appeal(round_id)` | Appeal object or empty dict |
| `get_escrow(round_id)` | `{ round_id, locked_amount }` in wei |
| `get_contract_stats()` | `{ total_rounds, total_bids, total_appeals }` |

---

## Round Lifecycle

```
draft
  └─ open_round() ──► open_for_bids
                           └─ close_bids() ──► bid_submission_closed
                                                   └─ request_evaluation() ──► under_consensus_evaluation
                                                                                    └─ [validators complete] ──► recommendation_issued
                                                                                                                      ├─ finalize_recommendation() ──► finalized
                                                                                                                      └─ [appeal filed] ──► appeal_window_open
                                                                                                                                               └─ request_appeal_review() ──► appeal_under_review
                                                                                                                                                                                  └─ [reviewed] ──► finalized
```

Edge-case verdicts: `no_valid_bid`, `tie_detected`, `insufficient_evidence`, `manual_review_required`, `unverifiable`

---

## Known Limitations

- StudioNet state resets periodically — do not use for production data
- Evaluation takes 30–90 seconds (LLM validators), longer when evidence URLs are fetched
- `get_all_rounds()` iterates linearly — may be slow at large round counts
- Escrow amounts must be whole GEN units from the UI; sub-unit deposits require a direct contract call

---

## License

MIT
