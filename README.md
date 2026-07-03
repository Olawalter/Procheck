# Procurement Consensus

**GenLayer-powered bid evaluation that awards the best-value proposal — not the cheapest one.**

> Contact: walterolaolu@gmail.com

---

## The Problem

Procurement is one of the most corruption-prone processes in the world — not because buyers are dishonest, but because the tools they use are. Traditional smart contracts can only compare numbers. They cannot read a technical proposal, assess whether a warranty is credible, judge if a supplier's delivery timeline is realistic, or weigh five competing criteria against each other.

The result? Contracts go to the cheapest bidder. And the cheapest bidder is rarely the best value.

**Procurement Consensus fixes this** by bringing GenLayer validators into the evaluation loop. Instead of arithmetic, you get reasoning. Instead of the lowest number, you get the best-value recommendation — transparent, on-chain, and auditable by anyone.

---

## What It Does

Procurement Consensus is a full-stack dApp built on GenLayer StudioNet. It lets buyers create procurement rounds with weighted evaluation criteria, accept structured bids from suppliers, and then trigger a validator consensus evaluation that produces a canonical award recommendation.

The whole lifecycle — round creation, bid submission, evaluation, appeal, finalization — is on-chain.

**Core flow:**

1. Buyer creates a round with a title, category, budget range, criteria weights (e.g. 40% quality, 25% price, 20% delivery, 15% compliance), mandatory requirements, and a bid deadline
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
| Wallet | Auto-generated localStorage private key (StudioNet demo wallet) |
| Network | GenLayer StudioNet — chain ID 61999, RPC `https://studio.genlayer.com/api` |

---

## Project Structure

```
ProCheck/
├── contract/
│   └── procurement_consensus.py   # Intelligent Contract
├── src/
│   ├── app/
│   │   ├── page.tsx               # Landing page
│   │   ├── layout.tsx
│   │   ├── rounds/
│   │   │   ├── page.tsx           # Bid Board — all rounds
│   │   │   ├── create/page.tsx    # Create procurement round
│   │   │   └── [roundId]/
│   │   │       ├── page.tsx       # Round detail + buyer actions
│   │   │       ├── submit-bid/page.tsx
│   │   │       ├── evaluation/page.tsx
│   │   │       └── appeal/page.tsx
│   │   └── profile/page.tsx       # My rounds + my bids
│   ├── components/
│   │   ├── ui/                    # Button, Badge, Toast
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
│   │   └── WalletContext.tsx      # Auto-generate / persist private key
│   ├── lib/
│   │   ├── genlayer.ts            # readContract / writeContract / waitForTransaction
│   │   └── utils.ts
│   └── types/
│       └── index.ts               # All shared TypeScript types
```

---

## Getting Started

### 1. Install the GenLayer CLI

```bash
npm install -g genlayer
```

### 2. Deploy the contract

```bash
genlayer deploy contract/procurement_consensus.py --network studionet
```

Copy the contract address from the output.

### 3. Configure environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_CHAIN_NAME=GenLayer StudioNet
NEXT_PUBLIC_CHAIN_ID=61999
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_EXPLORER_URL=https://explorer-studio.genlayer.com
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0xYOUR_CONTRACT_ADDRESS
```

### 4. Run the frontend

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Running the Ambulance Demo

The built-in demo scenario showcases everything: competing bids with different tradeoffs, a non-lowest-price winner, and the reasoning behind it.

**Setup:**
- Open GenLayer Studio or connect to StudioNet (chain ID 61999)
- You'll need three separate wallet sessions (open three browser tabs, each generates a fresh wallet on first connect)

**Step 1 — Create the round (Wallet A — the buyer)**
- Title: `Ambulance Fleet Procurement`
- Category: `Medical Transport`
- Budget: 90,000 – 130,000 GEN
- Weights: Quality 40%, Price 25%, Delivery 20%, Compliance 15%
- Deadline: 7 days

**Step 2 — Open for bids, then submit three competing bids**

| Bid | Wallet | Price | Signal |
|---|---|---|---|
| Bid 1 | Wallet B | 85,000 GEN | Cheapest — but weak warranty, vague references |
| Bid 2 | Wallet C | 112,000 GEN | Strong spec, 45-day delivery, complete warranty and compliance |
| Bid 3 | Wallet D | 127,000 GEN | Strong spec but incomplete compliance evidence |

**Step 3 — Close bids and request evaluation (Wallet A)**
- GenLayer validators compare all three bids against the criteria
- Takes 30–90 seconds
- Expected result: **Bid 2 wins** with verdict `award_recommended` and reason code `best_value_not_lowest_price`

**Step 4 — Optionally file an appeal (Wallet B or C)**
- Use `price_miscalculation` or `technical_spec_misread` as the basis
- Validators review and return `appeal_granted` or `appeal_rejected`

**Step 5 — Buyer finalizes the recommendation**

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
| `cancel_round(round_id)` | Cancel round (buyer only, before bids) |
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
- Evaluation takes 30–90 seconds (LLM validators)
- Evidence URLs are passed to the contract as metadata — validators evaluate the summaries, not the actual URL content
- `get_all_rounds()` iterates linearly — may be slow at large round counts
- No GEN escrow or payment release in this version; operates in award recommendation mode

---

## License

MIT
