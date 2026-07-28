/**
 * Single procurement round — designed to produce a clean award_recommended verdict.
 * Uses a 90-second appeal window so the full lifecycle completes in one run.
 *
 *   node scripts/run-one-round.mjs
 */

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";

const envLines = readFileSync(".env.local", "utf8").split("\n");
const env = Object.fromEntries(
  envLines.filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);

const CONTRACT = env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS;
const EXPLORER  = "https://explorer-studio.genlayer.com";

console.log("━".repeat(60));
console.log("  Procurement Consensus — Single Seeded Round");
console.log("━".repeat(60));
console.log(`  Contract : ${CONTRACT}`);
console.log(`  Network  : GenLayer StudioNet\n`);

const BUYER_KEY      = "0x561d7e3dec45ea187356132646c3b3970267b4d2f09e4c51bc8b3b691918eef6";
const SUPPLIER_A_KEY = "0xc7e1e465254b42ae0be4c0ef570f50bb01d6b50a23add01cd068c7ed6465dc33";
const SUPPLIER_B_KEY = "0x7aaefa8f30ce5ded019d88467b769e9dc74fcdd3440092bbd49e79077dda0339";

function makeClient(key, label) {
  const account = privateKeyToAccount(key);
  return { account, client: createClient({ chain: studionet, account }), label, address: account.address };
}

const buyer     = makeClient(BUYER_KEY,      "Buyer     ");
const supplierA = makeClient(SUPPLIER_A_KEY, "Supplier A");
const supplierB = makeClient(SUPPLIER_B_KEY, "Supplier B");

console.log(`  Buyer      : ${buyer.address}`);
console.log(`  Supplier A : ${supplierA.address}`);
console.log(`  Supplier B : ${supplierB.address}\n`);

const ts  = () => new Date().toISOString().slice(11, 19);
const log = (a, m) => console.log(`[${ts()}] [${a.label}] ${m}`);
const sep = (t) => { console.log(`\n${"─".repeat(60)}\n  ${t}\n${"─".repeat(60)}`); };

async function read(fn, args = []) {
  const c = createClient({ chain: studionet });
  const r = await c.readContract({ address: CONTRACT, functionName: fn, args });
  if (typeof r === "string") { try { return JSON.parse(r); } catch { return r; } }
  return r;
}

async function send(actor, fn, args, value = BigInt(0)) {
  log(actor, `→ ${fn}${value > 0n ? `  [${value / BigInt(1e18)} GEN]` : ""}`);
  const hash = await actor.client.writeContract({ address: CONTRACT, functionName: fn, args, value });
  log(actor, `  tx: ${hash}`);
  await actor.client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 90, interval: 3000 });
  log(actor, `  ✓ confirmed`);
  return hash;
}

async function main() {
  // ── 1. Create round ────────────────────────────────────────────────────────
  sep("STEP 1 — Create Round (Laptop Procurement)");

  // Short appeal window (90 s) so we can close it right after evaluation
  const BID_DEADLINE   = Math.floor(Date.now() / 1000) + 30 * 86_400; // 30 days
  const APPEAL_WINDOW  = 90; // 90 seconds

  await send(buyer, "create_round", [
    "Laptop Procurement — 50 Units for Finance Department",
    "IT Equipment",
    "Procure 50 business laptops for the Finance Department. " +
    "Minimum spec: Intel Core i5-13th gen or equivalent, 16 GB RAM, 512 GB NVMe SSD, " +
    "14-inch FHD display, Windows 11 Pro licensed, TPM 2.0, fingerprint reader. " +
    "All units must arrive pre-imaged with the department SOE and be delivered within 21 days.",
    "50 laptops, pre-imaged, Windows 11 Pro",
    45_000,
    70_000,
    "Evaluate bids on: (1) specification match against mandatory minimums — RAM, CPU generation, storage, display; " +
    "(2) total price for 50 units; (3) delivery timeline; (4) warranty and local support coverage.",
    JSON.stringify({ spec_compliance: 40, price: 30, delivery: 20, warranty_support: 10 }),
    JSON.stringify([
      "All laptops must be new (not refurbished)",
      "Minimum 16 GB RAM and 512 GB NVMe SSD per unit",
      "Windows 11 Pro with valid OEM license on each unit",
      "Minimum 1-year onsite warranty; 3-year preferred",
      "Delivery and pre-imaging within 21 days of purchase order",
    ]),
    BID_DEADLINE,
    APPEAL_WINDOW,
  ], BigInt("1000000000000000000")); // 1 GEN escrow

  await new Promise(r => setTimeout(r, 4000));
  const stats   = await read("get_contract_stats");
  const roundId = Number(stats.total_rounds);
  log(buyer, `Round ID: ${roundId}`);
  const rd = await read("get_round", [roundId]);
  log(buyer, `Escrow: ${rd.escrow_deposited} wei`);

  // ── 2. Open ────────────────────────────────────────────────────────────────
  sep("STEP 2 — Open Round");
  await send(buyer, "open_round", [roundId]);

  // ── 3. Bid A — strong: Dell Latitude, full spec, fast delivery ─────────────
  sep("STEP 3 — Supplier A Submits Bid (Dell Latitude, 18-day delivery, 3-yr onsite)");
  await send(supplierA, "submit_bid", [
    roundId,
    62_500,  // price for 50 units
    18,      // delivery days
    "50x Dell Latitude 5540 (Intel Core i5-1345U, 16 GB DDR4, 512 GB NVMe SSD, " +
    "15.6-inch FHD IPS, Windows 11 Pro OEM, TPM 2.0, fingerprint reader). " +
    "All units pre-imaged with Finance SOE using our certified imaging facility. " +
    "Dell Business Premium partner with dedicated public sector account team. " +
    "Delivered and asset-tagged within 18 days. Previous supply: 120 laptops to Ministry of Finance (2023), " +
    "80 units to FIRS (2022).",
    "Dell ProSupport 3-year onsite NBD warranty on all 50 units. " +
    "Hardware fault replacement within 4 hours in Lagos, Abuja, Port Harcourt. " +
    "Dedicated helpdesk line for the Finance Department included.",
    "Authorised Dell Business Premium reseller (partner ID: DELL-NG-BIZ-0447). " +
    "2 completed government laptop procurements: Ministry of Finance 120 units (2023), FIRS 80 units (2022). " +
    "CAC registered, NITDA vendor #NIT-2024-0881.",
    JSON.stringify([
      "https://en.wikipedia.org/wiki/Dell_Latitude",
      "https://en.wikipedia.org/wiki/Dell",
    ]),
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const sA     = await read("get_contract_stats");
  const bidAId = Number(sA.total_bids);
  log(supplierA, `Bid A ID: ${bidAId}`);

  // ── 4. Bid B — weak: unknown brand, 8 GB RAM (below spec), long delivery ───
  sep("STEP 4 — Supplier B Submits Bid (off-brand, 8 GB RAM, 35-day delivery)");
  await send(supplierB, "submit_bid", [
    roundId,
    48_000,  // cheaper but below spec
    35,      // slower delivery
    "50x TechPlus NB14 (Intel Core i5-10th gen, 8 GB DDR4, 256 GB SSD, " +
    "14-inch HD display, Windows 11 Pro). Units shipped from overseas; " +
    "pre-imaging available on request but adds 7 additional days. " +
    "No prior government laptop supply references.",
    "1-year return-to-base warranty. Faults must be shipped to vendor Lagos depot. " +
    "No onsite support. No hardware replacement SLA.",
    "CAC registered (RC-1182047). " +
    "General IT reseller; no specialised government procurement references.",
    JSON.stringify([
      "https://en.wikipedia.org/wiki/Laptop",
    ]),
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const sB     = await read("get_contract_stats");
  const bidBId = Number(sB.total_bids);
  log(supplierB, `Bid B ID: ${bidBId}`);

  // ── 5. Close bids ──────────────────────────────────────────────────────────
  sep("STEP 5 — Close Bids");
  await send(buyer, "close_bids", [roundId]);

  const bids = await read("get_round_bids", [roundId]);
  log(buyer, `${bids.length} bids received:`);
  for (const b of bids) {
    log(buyer, `  Bid ${b.bid_id}  price=${b.price}  delivery=${b.delivery_timeline_days}d  supplier=${b.supplier.slice(0, 12)}…`);
  }

  // ── 6. Request evaluation ──────────────────────────────────────────────────
  sep("STEP 6 — Request Validator Consensus Evaluation");
  console.log("  Validators will scrape evidence URLs and run independent LLM re-evaluation.");
  console.log("  Typical wait: 60–180 seconds on StudioNet.\n");
  await send(buyer, "request_evaluation", [roundId]);

  // ── 7. Poll ────────────────────────────────────────────────────────────────
  sep("STEP 7 — Polling for Result");
  let evalResult = null;
  for (let i = 0; i < 150; i++) {
    await new Promise(r => setTimeout(r, 8000));
    try {
      const round = await read("get_round", [roundId]);
      if (!["under_consensus_evaluation", "bid_submission_closed"].includes(round.status)) {
        evalResult = await read("get_evaluation_result", [roundId]);
        log(buyer, `Evaluation complete — status: ${round.status}`);
        break;
      }
      if (i % 4 === 0) log(buyer, `Still evaluating… (${i * 8}s elapsed)`);
    } catch (e) {
      log(buyer, `Transient error: ${String(e.message ?? e).slice(0, 60)}, retrying…`);
    }
  }

  if (!evalResult || !evalResult.verdict) {
    console.log(`\n⚠  Evaluation timed out. Resume with:`);
    console.log(`   RESUME_ROUND_ID=${roundId} node scripts/e2e-test.mjs\n`);
    return;
  }

  console.log("\n  ┌──────────────────────────────────────────────────────┐");
  console.log(`  │  Verdict     : ${evalResult.verdict}`);
  console.log(`  │  Winner bid  : ${evalResult.recommended_bid_id}`);
  console.log(`  │  Winner addr : ${String(evalResult.recommended_supplier).slice(0, 22)}…`);
  console.log(`  │  Confidence  : ${evalResult.confidence}%`);
  console.log(`  │  Quality     : ${evalResult.quality_band}`);
  console.log(`  │  Price       : ${evalResult.price_value_band}`);
  console.log(`  │  Compliance  : ${evalResult.compliance_band}`);
  console.log(`  │  Risk        : ${evalResult.risk_band}`);
  console.log(`  │  Reason      : ${evalResult.short_reason}`);
  console.log("  └──────────────────────────────────────────────────────┘\n");

  // ── 8. Wait for appeal window to elapse (90 s) then close ─────────────────
  sep("STEP 8 — Wait 95s for Appeal Window, Then Close");
  console.log("  Appeal window is 90 seconds. Waiting 95 seconds before closing…\n");
  for (let s = 95; s > 0; s -= 5) {
    await new Promise(r => setTimeout(r, 5000));
    process.stdout.write(`\r  ${s}s remaining…  `);
  }
  console.log("\n");

  await send(buyer, "close_appeal_window", [roundId]);
  const afterClose = await read("get_round", [roundId]);
  log(buyer, `Status after close: ${afterClose.status}`);

  // ── 9. Finalize ────────────────────────────────────────────────────────────
  sep("STEP 9 — Finalize Recommendation (Escrow Release)");
  const pre = await read("get_round", [roundId]);
  log(buyer, `Escrow before: ${pre.escrow_deposited} wei`);

  await send(buyer, "finalize_recommendation", [roundId]);

  const post = await read("get_round", [roundId]);
  log(buyer, `Escrow after:  ${post.escrow_deposited} wei`);
  log(buyer, `Final status:  ${post.status}`);

  const escrowOk  = (post.escrow_deposited ?? "0") === "0";
  const winnerOk  = evalResult.recommended_bid_id === bidAId;

  sep("COMPLETE");
  console.log(`  Round ID    : ${roundId}`);
  console.log(`  Bid A ID    : ${bidAId}  (Supplier A — Dell Latitude, 18d, 3yr onsite)`);
  console.log(`  Bid B ID    : ${bidBId}  (Supplier B — TechPlus, 35d, 8GB RAM)`);
  console.log(`  Winner      : Bid ${evalResult.recommended_bid_id} — ${evalResult.verdict}`);
  console.log(`  Escrow released : ${escrowOk ? "✓ YES" : "✗ NO"}`);
  console.log(`  Correct winner  : ${winnerOk ? "✓ YES (Bid A)" : `⚠ Bid ${evalResult.recommended_bid_id}`}`);
  console.log(`\n  Explorer : ${EXPLORER}/address/${CONTRACT}`);
  console.log(`  Live app : https://procheck-theta.vercel.app\n`);
}

main().catch(err => {
  console.error("\n❌  Fatal:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
