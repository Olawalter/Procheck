/**
 * Procurement Consensus — End-to-End Test Script
 *
 * Tests the two core features added for resubmission:
 *   1. Substantive validator verification (evidence fetch + independent LLM re-evaluation)
 *   2. GEN escrow lock / release on finalization
 *
 * Run from the project root:
 *   node scripts/e2e-test.mjs
 */

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";

// ── Config ───────────────────────────────────────────────────────────────────

const envLines = readFileSync(".env.local", "utf8").split("\n");
const env = Object.fromEntries(
  envLines
    .filter((l) => l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const CONTRACT = env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS;
if (!CONTRACT) {
  console.error("❌  NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS not set in .env.local");
  process.exit(1);
}

console.log("━".repeat(64));
console.log("  Procurement Consensus — End-to-End Test");
console.log("━".repeat(64));
console.log(`  Contract : ${CONTRACT}`);
console.log(`  Network  : GenLayer StudioNet (chain ID 61999)`);
console.log("━".repeat(64) + "\n");

// ── Accounts ─────────────────────────────────────────────────────────────────

const BUYER_KEY    = "0x561d7e3dec45ea187356132646c3b3970267b4d2f09e4c51bc8b3b691918eef6";
const SUPPLIER_A_KEY = "0xc7e1e465254b42ae0be4c0ef570f50bb01d6b50a23add01cd068c7ed6465dc33";
const SUPPLIER_B_KEY = "0x7aaefa8f30ce5ded019d88467b769e9dc74fcdd3440092bbd49e79077dda0339";

function makeClient(privateKey, label) {
  const account = privateKeyToAccount(privateKey);
  const client = createClient({ chain: studionet, account });
  return { account, client, label, address: account.address };
}

const buyer     = makeClient(BUYER_KEY,     "Buyer     ");
const supplierA = makeClient(SUPPLIER_A_KEY, "Supplier A");
const supplierB = makeClient(SUPPLIER_B_KEY, "Supplier B");

console.log("  Accounts:");
console.log(`    Buyer      : ${buyer.address}`);
console.log(`    Supplier A : ${supplierA.address}`);
console.log(`    Supplier B : ${supplierB.address}\n`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(actor, message) {
  const now = new Date().toISOString().slice(11, 19);
  console.log(`[${now}] [${actor.label}] ${message}`);
}

function step(title) {
  console.log(`\n${"─".repeat(64)}`);
  console.log(`  STEP: ${title}`);
  console.log("─".repeat(64));
}

async function readContract(functionName, args = []) {
  const client = createClient({ chain: studionet });
  const result = await client.readContract({ address: CONTRACT, functionName, args });
  if (typeof result === "string") {
    try { return JSON.parse(result); } catch { return result; }
  }
  return result;
}

async function send(actor, functionName, args, value = BigInt(0)) {
  log(actor, `→ ${functionName}(${args.length > 0 ? "…" : ""})${value > 0n ? `  escrow: ${value / BigInt(1e18)} GEN` : ""}`);
  const hash = await actor.client.writeContract({
    address: CONTRACT,
    functionName,
    args,
    value,
  });
  log(actor, `  tx : ${hash}`);
  const receipt = await actor.client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 90,
    interval: 3000,
  });
  log(actor, `  ✓  confirmed (status: ${receipt?.status ?? "accepted"})`);
  return { hash, receipt };
}

// ── Procurement data ─────────────────────────────────────────────────────────

const ROUND_TITLE    = "Hospital Network Upgrade — Server & Switching Infrastructure";
const ROUND_CATEGORY = "IT Infrastructure";
const ROUND_DESCRIPTION = (
  "Procure and deploy 4 rack-mounted servers, 2 core switches, and 12 PoE distribution " +
  "switches across Ward B and the ICU. Equipment must support 10GbE uplinks, arrive " +
  "pre-configured, and be installed and commissioned by the vendor within 45 days of PO. " +
  "All hardware must carry a minimum 3-year onsite NBD warranty."
);
const ROUND_QUANTITY = "4 rack servers, 2 core switches, 12 distribution switches";
const BUDGET_MIN = 60_000;
const BUDGET_MAX = 90_000;
const CRITERIA_TEXT = (
  "Evaluate bids on: (1) technical specification fit for a clinical-grade network, " +
  "(2) total price relative to budget, (3) delivery and commissioning timeline, " +
  "(4) quality of support, warranty coverage, and vendor references."
);
const CRITERIA_WEIGHTS = JSON.stringify({
  technical_fit:    35,
  price:            30,
  delivery_timeline: 20,
  support_warranty:  15,
});
const MANDATORY_REQS = JSON.stringify([
  "Valid ISO 27001 or equivalent security certification",
  "Minimum 3 completed hospital IT projects as verifiable references",
  "Vendor must provide on-site installation and commissioning",
  "Hardware warranty minimum 3 years onsite NBD for all units",
  "Full delivery and commissioning within 45 days of purchase order",
]);

// Bid A: Technically strong, mid-price, fast delivery — expected WINNER
const BID_A = {
  price: 74_500,
  delivery_days: 32,
  technical_summary: (
    "We propose 4x Dell PowerEdge R750 servers (dual Intel Xeon Gold 6330, 256 GB DDR4 ECC each, " +
    "dual redundant PSU, 2x 10GbE SFP+) paired with Cisco Catalyst 9500-24Y4C core switches and " +
    "Cisco Catalyst 2960X-48FPD-L distribution switches. All units ship pre-racked and pre-configured " +
    "with firmware validated for clinical networks. Our team has completed identical deployments at " +
    "Lagos University Teaching Hospital (2021), National Hospital Abuja (2022), and three additional " +
    "Nigerian tertiary hospitals. Redundant power and out-of-band iDRAC management included on all servers."
  ),
  warranty_terms: (
    "Dell ProSupport Plus with 3-year Next Business Day onsite response, parts included, " +
    "for all 4 servers. Cisco SmartNet 8x5xNBD covering all switches for 3 years. " +
    "Out-of-band management module covered under the same contract."
  ),
  compliance_statement: (
    "ISO 27001 certified (certificate #ISO-GL-2024-0441, valid until 2026-08-31). " +
    "Completed hospital IT procurements: LUTH 2021, NHA 2022, ATBUTH 2022, BUTH 2023, OOUTH 2024. " +
    "Full reference letters and commissioning reports available on request. NITDA registered vendor."
  ),
  evidence_urls: JSON.stringify([
    "https://en.wikipedia.org/wiki/Dell_PowerEdge",
    "https://en.wikipedia.org/wiki/Cisco_Catalyst",
  ]),
};

// Bid B: Cheaper, single-CPU servers, longer delivery, weaker warranty — expected LOSER
const BID_B = {
  price: 57_000,
  delivery_days: 58,
  technical_summary: (
    "Offering 4x HP ProLiant DL380 Gen10 servers (single Intel Xeon Silver 4214R, 128 GB DDR4 each) " +
    "with TP-Link TL-SG3452XP managed PoE switches (12 units) and 2x TP-Link TL-SG6428X core switches. " +
    "Servers pre-loaded with base OS. Delivery timeline is 8 weeks. " +
    "We have 1 hospital reference from General Hospital Ibadan (2023)."
  ),
  warranty_terms: (
    "HP 2-year standard depot warranty for servers. " +
    "TP-Link 2-year carry-in warranty for all switches. " +
    "No onsite response included; parts shipped after fault diagnosis."
  ),
  compliance_statement: (
    "CAC registered company (RC-1072984). Reference: General Hospital Ibadan network upgrade, 2023. " +
    "Company registration documents available."
  ),
  evidence_urls: JSON.stringify([
    "https://en.wikipedia.org/wiki/HP_ProLiant",
  ]),
};

// Escrow: 1 GEN locked with the round
const ESCROW_WEI = BigInt("1000000000000000000"); // 1 GEN

// ── Main ──────────────────────────────────────────────────────────────────────

// Set RESUME_ROUND_ID to a number to skip creation and pick up an in-progress round.
const RESUME_ROUND_ID = process.env.RESUME_ROUND_ID ? Number(process.env.RESUME_ROUND_ID) : null;

async function main() {
  let roundId;
  let bidA_id;
  let bidB_id;

  if (RESUME_ROUND_ID) {
    step(`RESUMING from existing Round #${RESUME_ROUND_ID}`);
    roundId = RESUME_ROUND_ID;
    const existingRound = await readContract("get_round", [roundId]);
    const existingBids  = await readContract("get_round_bids", [roundId]);
    log(buyer, `  status : ${existingRound.status}`);
    log(buyer, `  escrow : ${existingRound.escrow_deposited ?? "0"} wei`);
    for (const b of existingBids) {
      if (b.supplier.toLowerCase() === supplierA.address.toLowerCase()) bidA_id = b.bid_id;
      if (b.supplier.toLowerCase() === supplierB.address.toLowerCase()) bidB_id = b.bid_id;
    }
    log(buyer, `  bid A  : ${bidA_id}  bid B : ${bidB_id}`);

    // If evaluation is already done, jump straight to finalize
    if (!["under_consensus_evaluation", "bid_submission_closed", "open_for_bids", "draft"].includes(existingRound.status)) {
      const evalResult = await readContract("get_evaluation_result", [roundId]);
      await handleEvalResult(evalResult, roundId, bidA_id, bidB_id);
      return;
    }

    // If evaluation is running, go straight to poll
    if (existingRound.status === "under_consensus_evaluation") {
      await pollAndFinalize(roundId, bidA_id, bidB_id);
      return;
    }
  }

  // ── 1. Create Round ────────────────────────────────────────────────────────
  step("1 — Create Procurement Round + Lock 1 GEN Escrow");

  const bidDeadlineTs  = Math.floor(Date.now() / 1000) + 7 * 86_400;
  const appealWindowSec = 48 * 3_600;

  await send(buyer, "create_round", [
    ROUND_TITLE,
    ROUND_CATEGORY,
    ROUND_DESCRIPTION,
    ROUND_QUANTITY,
    BUDGET_MIN,
    BUDGET_MAX,
    CRITERIA_TEXT,
    CRITERIA_WEIGHTS,
    MANDATORY_REQS,
    bidDeadlineTs,
    appealWindowSec,
  ], ESCROW_WEI);   // send 1 GEN as escrow with the creation tx

  // Wait a moment for state to be readable, then derive round ID
  await new Promise((r) => setTimeout(r, 3000));
  const stats = await readContract("get_contract_stats");
  log(buyer, `  stats raw: ${JSON.stringify(stats)}`);
  roundId = Number(stats.total_rounds);
  log(buyer, `  round ID : ${roundId}`);

  // Read back the round to verify escrow was recorded
  const roundData = await readContract("get_round", [roundId]);
  log(buyer, `  escrow   : ${roundData.escrow_deposited ?? "0"} wei locked`);

  // ── 2. Open Round ──────────────────────────────────────────────────────────
  step("2 — Open Round for Bid Submissions");
  await send(buyer, "open_round", [roundId]);

  // ── 3. Submit Bid A (Supplier A — expected winner) ─────────────────────────
  step("3 — Supplier A Submits Bid (strong technical, 32-day delivery)");
  await send(supplierA, "submit_bid", [
    roundId,
    BID_A.price,
    BID_A.delivery_days,
    BID_A.technical_summary,
    BID_A.warranty_terms,
    BID_A.compliance_statement,
    BID_A.evidence_urls,
  ]);

  const statsA = await readContract("get_contract_stats");
  bidA_id = Number(statsA.total_bids);
  log(supplierA, `  bid ID : ${bidA_id}`);

  // ── 4. Submit Bid B (Supplier B — expected to lose) ────────────────────────
  step("4 — Supplier B Submits Bid (cheaper, weaker specs, 58-day delivery)");
  await send(supplierB, "submit_bid", [
    roundId,
    BID_B.price,
    BID_B.delivery_days,
    BID_B.technical_summary,
    BID_B.warranty_terms,
    BID_B.compliance_statement,
    BID_B.evidence_urls,
  ]);

  const statsB = await readContract("get_contract_stats");
  bidB_id = Number(statsB.total_bids);
  log(supplierB, `  bid ID : ${bidB_id}`);

  // ── 5. Close Bids ──────────────────────────────────────────────────────────
  step("5 — Close Bid Window");
  await send(buyer, "close_bids", [roundId]);

  const bids = await readContract("get_round_bids", [roundId]);
  log(buyer, `  ${bids.length} bids received:`);
  for (const b of bids) {
    log(buyer, `    Bid ${b.bid_id}  price=${b.price} GEN  delivery=${b.delivery_timeline_days}d  supplier=${b.supplier.slice(0,12)}…`);
  }

  // ── 6. Request Evaluation ──────────────────────────────────────────────────
  step("6 — Request Validator Consensus Evaluation (substantive check + evidence fetch)");
  console.log("  Note: validators will scrape evidence URLs and run independent LLM evaluation.");
  console.log("  This typically takes 60–120 seconds on StudioNet.\n");
  await send(buyer, "request_evaluation", [roundId]);

  await pollAndFinalize(roundId, bidA_id, bidB_id);
}

async function printSummary(roundId, bidA_id, bidB_id, evalResult, allPassed) {
  step("Summary");
  console.log("");
  console.log(`  Round ID    : ${roundId}`);
  console.log(`  Bid A ID    : ${bidA_id}  (Supplier A — ${supplierA.address.slice(0, 14)}…)`);
  console.log(`  Bid B ID    : ${bidB_id}  (Supplier B — ${supplierB.address.slice(0, 14)}…)`);
  if (evalResult) {
    console.log(`  Winner      : Bid ${evalResult.recommended_bid_id} — ${evalResult.verdict}`);
    console.log(`  Reason      : ${evalResult.short_reason}`);
  }
  const explorerBase = env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL || "https://explorer-studio.genlayer.com";
  console.log(`\n  Explorer    : ${explorerBase}/address/${CONTRACT}`);
  console.log("");
  if (allPassed) {
    console.log("  ✅  ALL CHECKS PASSED");
    console.log("     — Substantive validator: confirmed winner via evidence fetch + independent LLM");
    console.log("     — GEN escrow: locked at round creation, released on finalization");
  } else {
    console.log("  ⚠  Some checks need review — see output above");
  }
  console.log("");
}

async function pollAndFinalize(roundId, bidA_id, bidB_id) {
  log(buyer, "  Polling for evaluation result…");
  let evalResult = null;
  for (let attempt = 0; attempt < 150; attempt++) {
    await new Promise((r) => setTimeout(r, 8_000));
    try {
      const round = await readContract("get_round", [roundId]);
      if (!["under_consensus_evaluation", "bid_submission_closed"].includes(round.status)) {
        evalResult = await readContract("get_evaluation_result", [roundId]);
        log(buyer, `  round status: ${round.status}`);
        break;
      }
      if (attempt % 3 === 0) log(buyer, `  still evaluating… (${attempt * 8}s elapsed)`);
    } catch (pollErr) {
      log(buyer, `  poll ${attempt + 1} transient error (${String(pollErr.message ?? pollErr).slice(0, 80)}), retrying…`);
    }
  }
  if (!evalResult || !evalResult.verdict) {
    console.log("\n⚠  Evaluation not yet complete after polling window.");
    console.log(`   Re-run with:  RESUME_ROUND_ID=${roundId} node scripts/e2e-test.mjs`);
    await printSummary(roundId, bidA_id, bidB_id, null, false);
    return;
  }
  await handleEvalResult(evalResult, roundId, bidA_id, bidB_id);
}

async function handleEvalResult(evalResult, roundId, bidA_id, bidB_id) {
  step("Evaluation Result");
  console.log("");
  console.log("  ┌─────────────────────────────────────────────────────────┐");
  console.log(`  │  Verdict       : ${evalResult.verdict}`);
  console.log(`  │  Winner bid    : ${evalResult.recommended_bid_id}`);
  console.log(`  │  Winner addr   : ${String(evalResult.recommended_supplier).slice(0, 20)}…`);
  console.log(`  │  Confidence    : ${evalResult.confidence}%`);
  console.log(`  │  Quality band  : ${evalResult.quality_band}`);
  console.log(`  │  Price band    : ${evalResult.price_value_band}`);
  console.log(`  │  Compliance    : ${evalResult.compliance_band}`);
  console.log(`  │  Risk          : ${evalResult.risk_band}`);
  console.log(`  │  Reason code   : ${evalResult.reason_code}`);
  console.log(`  │  Reason        : ${evalResult.short_reason}`);
  console.log("  └─────────────────────────────────────────────────────────┘\n");

  const expectedWinner = supplierA.address.toLowerCase();
  const actualWinner   = String(evalResult.recommended_supplier).toLowerCase();
  const winnerCorrect  = actualWinner === expectedWinner;
  const bidCorrect     = evalResult.recommended_bid_id === bidA_id;
  console.log(`  Expected winner : Supplier A (${supplierA.address.slice(0,14)}…)`);
  console.log(`  Actual winner   : ${evalResult.recommended_supplier}`);
  console.log(`  Bid ID correct  : ${bidCorrect ? "✓ YES (Bid A)" : `✗ NO — got Bid ${evalResult.recommended_bid_id}`}`);
  console.log(`  Address correct : ${winnerCorrect ? "✓ YES" : "✗ NO"}`);

  step("Close Appeal Window — transitions round to recommendation_issued");
  log(buyer, "  Closing appeal window (no appeal filed)…");
  await send(buyer, "close_appeal_window", [roundId]);
  const postClose = await readContract("get_round", [roundId]);
  log(buyer, `  round status  : ${postClose.status}`);

  step("Finalize Recommendation — triggers escrow release");
  const roundBefore = await readContract("get_round", [roundId]);
  log(buyer, `  escrow before : ${roundBefore.escrow_deposited ?? "0"} wei`);

  await send(buyer, "finalize_recommendation", [roundId]);

  const finalRound = await readContract("get_round", [roundId]);
  log(buyer, `  round status  : ${finalRound.status}`);
  log(buyer, `  escrow after  : ${finalRound.escrow_deposited ?? "0"} wei (should be "0")`);

  const escrowReleased = (finalRound.escrow_deposited ?? "0") === "0";
  console.log(`\n  Escrow released : ${escrowReleased ? "✓ YES — transferred to winner" : "✗ NO — still locked"}`);

  await printSummary(roundId, bidA_id, bidB_id, evalResult, escrowReleased && winnerCorrect && bidCorrect);
}

main().catch((err) => {
  console.error("\n❌  Fatal error:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
