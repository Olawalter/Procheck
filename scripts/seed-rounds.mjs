/**
 * Procurement Consensus — Seed Script
 * Runs 3 complete procurement rounds end-to-end on the deployed contract:
 *   Round 1 — IT Infrastructure (Hospital Network Upgrade)
 *   Round 2 — Solar Energy Installation (Renewable Energy)
 *   Round 3 — Office Furniture & Fit-Out (Facilities)
 *
 * Run from the project root:
 *   node scripts/seed-rounds.mjs
 *
 * To skip creation and resume from a specific round ID:
 *   START_ROUND=2 node scripts/seed-rounds.mjs
 */

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";

// ── Config ────────────────────────────────────────────────────────────────────

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

const EXPLORER = env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL || "https://explorer-studio.genlayer.com";

console.log("━".repeat(64));
console.log("  Procurement Consensus — Seed Rounds (3 rounds)");
console.log("━".repeat(64));
console.log(`  Contract : ${CONTRACT}`);
console.log(`  Explorer : ${EXPLORER}/address/${CONTRACT}`);
console.log("━".repeat(64) + "\n");

// ── Accounts ──────────────────────────────────────────────────────────────────

const BUYER_KEY      = "0x561d7e3dec45ea187356132646c3b3970267b4d2f09e4c51bc8b3b691918eef6";
const SUPPLIER_A_KEY = "0xc7e1e465254b42ae0be4c0ef570f50bb01d6b50a23add01cd068c7ed6465dc33";
const SUPPLIER_B_KEY = "0x7aaefa8f30ce5ded019d88467b769e9dc74fcdd3440092bbd49e79077dda0339";

function makeClient(privateKey, label) {
  const account = privateKeyToAccount(privateKey);
  const client  = createClient({ chain: studionet, account });
  return { account, client, label, address: account.address };
}

const buyer     = makeClient(BUYER_KEY,      "Buyer     ");
const supplierA = makeClient(SUPPLIER_A_KEY, "Supplier A");
const supplierB = makeClient(SUPPLIER_B_KEY, "Supplier B");

console.log("  Accounts:");
console.log(`    Buyer      : ${buyer.address}`);
console.log(`    Supplier A : ${supplierA.address}`);
console.log(`    Supplier B : ${supplierB.address}\n`);

// ── Helpers ───────────────────────────────────────────────────────────────────

const ts = () => new Date().toISOString().slice(11, 19);
const log  = (actor, msg) => console.log(`[${ts()}] [${actor.label}] ${msg}`);
const step = (title) => {
  console.log(`\n${"─".repeat(64)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(64));
};

async function read(functionName, args = []) {
  const client = createClient({ chain: studionet });
  const result = await client.readContract({ address: CONTRACT, functionName, args });
  if (typeof result === "string") {
    try { return JSON.parse(result); } catch { return result; }
  }
  return result;
}

async function send(actor, functionName, args, value = BigInt(0)) {
  log(actor, `→ ${functionName}${value > 0n ? `  [${value / BigInt(1e18)} GEN escrow]` : ""}`);
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
  log(actor, `  ✓  confirmed`);
  return { hash, receipt };
}

async function pollEvaluation(roundId) {
  log(buyer, `Polling evaluation for round ${roundId}…`);
  for (let i = 0; i < 150; i++) {
    await new Promise((r) => setTimeout(r, 8_000));
    try {
      const round = await read("get_round", [roundId]);
      if (!["under_consensus_evaluation", "bid_submission_closed"].includes(round.status)) {
        log(buyer, `  evaluation complete — status: ${round.status}`);
        return await read("get_evaluation_result", [roundId]);
      }
      if (i % 4 === 0) log(buyer, `  still evaluating… (${i * 8}s)`);
    } catch (e) {
      log(buyer, `  transient error: ${String(e.message ?? e).slice(0, 60)}, retrying…`);
    }
  }
  return null;
}

const ESCROW = BigInt("1000000000000000000"); // 1 GEN
const BID_DEADLINE = () => Math.floor(Date.now() / 1000) + 14 * 86_400; // 2 weeks
const APPEAL_WINDOW = 48 * 3_600; // 48 h

// ── Round definitions ─────────────────────────────────────────────────────────

const ROUNDS = [
  // ── ROUND 1: IT Infrastructure ────────────────────────────────────────────
  {
    title:    "Hospital Network Upgrade — Server & Switching Infrastructure",
    category: "IT Infrastructure",
    description:
      "Procure and deploy 4 rack-mounted servers, 2 core switches, and 12 PoE distribution " +
      "switches across Ward B and the ICU. Equipment must support 10GbE uplinks, arrive " +
      "pre-configured, and be installed and commissioned within 45 days of PO. " +
      "All hardware must carry a minimum 3-year onsite NBD warranty.",
    quantity:   "4 rack servers, 2 core switches, 12 distribution switches",
    budgetMin:  60_000,
    budgetMax:  90_000,
    criteria:
      "Evaluate on: (1) technical specification fit for a clinical-grade network, " +
      "(2) total price relative to budget, (3) delivery and commissioning timeline, " +
      "(4) quality of support, warranty coverage, and vendor references.",
    weights: JSON.stringify({ technical_fit: 35, price: 30, delivery_timeline: 20, support_warranty: 15 }),
    mandatory: JSON.stringify([
      "Valid ISO 27001 or equivalent security certification",
      "Minimum 3 completed hospital IT projects as verifiable references",
      "Vendor must provide on-site installation and commissioning",
      "Hardware warranty minimum 3 years onsite NBD for all units",
      "Full delivery and commissioning within 45 days of purchase order",
    ]),
    bidA: {
      price: 74_500, delivery: 32,
      technical:
        "4x Dell PowerEdge R750 servers (dual Intel Xeon Gold 6330, 256 GB DDR4 ECC, dual PSU, 2x 10GbE SFP+) " +
        "paired with Cisco Catalyst 9500-24Y4C core switches and Cisco 2960X-48FPD-L distribution switches. " +
        "Pre-racked and pre-configured. Deployed at Lagos University Teaching Hospital (2021), " +
        "National Hospital Abuja (2022), and three additional tertiary hospitals.",
      warranty:
        "Dell ProSupport Plus 3-year NBD onsite for all servers. " +
        "Cisco SmartNet 8x5xNBD 3 years on all switches.",
      compliance:
        "ISO 27001 certified (#ISO-GL-2024-0441, valid 2026-08-31). " +
        "5 completed hospital IT projects: LUTH 2021, NHA 2022, ATBUTH 2022, BUTH 2023, OOUTH 2024. " +
        "NITDA registered vendor.",
      evidence: JSON.stringify(["https://en.wikipedia.org/wiki/Dell_PowerEdge", "https://en.wikipedia.org/wiki/Cisco_Catalyst"]),
    },
    bidB: {
      price: 57_000, delivery: 58,
      technical:
        "4x HP ProLiant DL380 Gen10 (single Xeon Silver 4214R, 128 GB DDR4) with TP-Link TL-SG3452XP PoE switches " +
        "and 2x TP-Link TL-SG6428X core switches. Base OS pre-loaded. " +
        "1 hospital reference: General Hospital Ibadan (2023).",
      warranty:
        "HP 2-year standard depot warranty for servers. TP-Link 2-year carry-in warranty. " +
        "No onsite response; parts shipped after diagnosis.",
      compliance:
        "CAC registered (RC-1072984). 1 hospital reference: General Hospital Ibadan 2023.",
      evidence: JSON.stringify(["https://en.wikipedia.org/wiki/HP_ProLiant"]),
    },
    note: "IT Infrastructure — Supplier A expected winner (better specs, warranty, more references)",
  },

  // ── ROUND 2: Solar Energy ─────────────────────────────────────────────────
  {
    title:    "100kW Solar PV & Battery Storage Installation — State Secretariat Complex",
    category: "Renewable Energy",
    description:
      "Design, supply, install, and commission a 100kW grid-tied solar PV system with " +
      "200kWh battery storage at the State Secretariat Complex. Scope includes structural " +
      "mounting, DC/AC wiring, grid interconnection, monitoring system, and staff training. " +
      "System must meet IEC 61215 and IEC 61730 standards. Completion within 60 days of NTP.",
    quantity:   "100kW solar PV array, 200kWh BESS, inverters, monitoring",
    budgetMin:  120_000,
    budgetMax:  180_000,
    criteria:
      "Evaluate on: (1) system design quality and component specifications, " +
      "(2) total installed price per kWp, (3) project timeline and commissioning plan, " +
      "(4) after-sales service, monitoring, and warranty terms.",
    weights: JSON.stringify({ system_design: 35, price_per_kwp: 30, timeline: 20, service_warranty: 15 }),
    mandatory: JSON.stringify([
      "NAFDAC/SON approved solar panels (IEC 61215 certified)",
      "Minimum 5 years performance warranty on panels",
      "Battery system UL 9540 certified or equivalent",
      "Vendor must have completed at least 2 government or commercial solar projects above 50kW",
      "Remote monitoring system included with 1-year free subscription",
    ]),
    bidA: {
      price: 148_000, delivery: 52,
      technical:
        "250x Jinko Solar Tiger Neo 400W bifacial panels (IEC 61215, 25-year linear performance warranty). " +
        "Huawei SUN2000-100KTL-M1 inverter with built-in optimizer. " +
        "CATL Prismatic LFP 200kWh BESS (UL 9540A certified, 10-year warranty). " +
        "Unirac RM Pro rooftop mounting. SolarEdge monitoring with 25-year cloud subscription. " +
        "Previously installed 120kW system at Kano Government House (2023) and 80kW at Abuja FCT Secretariat (2022).",
      warranty:
        "25-year linear panel performance warranty (Jinko). " +
        "10-year product warranty on inverter and BESS. " +
        "5-year workmanship warranty on installation. Dedicated maintenance contract available.",
      compliance:
        "SON certified installer (#SON-SE-2024-0118). " +
        "Completed: Kano Government House 120kW (2023), FCT Secretariat 80kW (2022), " +
        "Dangote Refinery backup solar 200kW (2024). NESREA registered.",
      evidence: JSON.stringify(["https://en.wikipedia.org/wiki/Jinko_Solar", "https://en.wikipedia.org/wiki/Solar_panel"]),
    },
    bidB: {
      price: 109_000, delivery: 75,
      technical:
        "250x generic Tier-2 350W panels (IEC 61215, 10-year performance warranty). " +
        "Growatt SPF 100kW three-phase inverter. " +
        "Lead-acid 200kWh BESS (no UL certification). " +
        "Basic galvanized steel mounting. " +
        "1 commercial solar project reference: private hotel 30kW (2022).",
      warranty:
        "10-year panel performance warranty. " +
        "2-year inverter warranty (manufacturer). " +
        "1-year workmanship warranty. No BESS warranty beyond manufacturer defects.",
      compliance:
        "CAC registered (RC-0887321). 1 solar project: private hotel, Lagos, 30kW, 2022.",
      evidence: JSON.stringify(["https://en.wikipedia.org/wiki/Growatt"]),
    },
    note: "Renewable Energy — Supplier A expected winner (tier-1 panels, certified BESS, government references)",
  },

  // ── ROUND 3: Office Furniture ─────────────────────────────────────────────
  {
    title:    "Open-Plan Office Furniture & Fit-Out — New HQ Building, Floors 3–5",
    category: "Facilities & Fit-Out",
    description:
      "Supply and install ergonomic workstations, executive desks, collaborative seating, " +
      "storage units, and reception furniture for approximately 180 staff across floors 3–5 " +
      "of the new headquarters building. Furniture must comply with BS EN 527 workstation " +
      "and BS EN 1335 chair standards. Full installation within 21 days of delivery.",
    quantity:   "180 workstations, 180 chairs, 12 executive desks, reception and collaboration zones",
    budgetMin:  85_000,
    budgetMax:  130_000,
    criteria:
      "Evaluate on: (1) ergonomic quality and compliance with BS EN standards, " +
      "(2) total price for the complete fit-out, (3) delivery and installation speed, " +
      "(4) after-sales support, warranty, and customisation options.",
    weights: JSON.stringify({ ergonomic_quality: 40, price: 30, delivery_speed: 20, support_warranty: 10 }),
    mandatory: JSON.stringify([
      "Chairs must meet BS EN 1335 Class A ergonomic standard",
      "Workstation desks must meet BS EN 527 dimensional standard",
      "Vendor must offer fabric/finish customisation to match corporate colour scheme",
      "Minimum 5-year warranty on structural components",
      "Full installation included; site must be handed over clear of packaging",
    ]),
    bidA: {
      price: 112_000, delivery: 18,
      technical:
        "Kinnarps 5000 Series height-adjustable desks (BS EN 527 compliant, electric lift) for all 180 workstations. " +
        "Kinnarps Plus 8 ergonomic task chairs (BS EN 1335 Class A, GREENGUARD Gold certified). " +
        "12 executive desks: Kinnarps T-series with integrated cable management. " +
        "Reception: Narbutas Nova U sofa system. Collaborative zones: Steelcase Flex. " +
        "Custom upholstery in corporate blue/grey palette. " +
        "Reference fit-outs: First Bank HQ Lagos (2022, 250 staff), GTBank Tech Centre (2023, 150 staff).",
      warranty:
        "10-year structural warranty on all Kinnarps desks and chairs. " +
        "5-year warranty on electric lift mechanisms. " +
        "2-year warranty on soft furnishings. Dedicated account manager post-installation.",
      compliance:
        "BS EN 1335 Class A certified (test report #FIRA-2024-3301). " +
        "BS EN 527 certified (test report #FIRA-2024-3302). " +
        "ISO 9001:2015 certified manufacturer. " +
        "Completed: First Bank HQ 250 staff (2022), GTBank Tech Centre 150 staff (2023).",
      evidence: JSON.stringify(["https://en.wikipedia.org/wiki/Kinnarps", "https://en.wikipedia.org/wiki/Steelcase"]),
    },
    bidB: {
      price: 88_000, delivery: 35,
      technical:
        "Generic import fixed-height desks (manufacturer claims EN 527 compliance, no third-party test report). " +
        "Ergohuman Basic chairs (limited lumbar adjustment, BS EN 1335 Class B). " +
        "MDF executive desks with laminate finish. No branded collaborative zone solution. " +
        "Colour options limited to stock black and grey. " +
        "1 office reference: private law firm, 40 staff (2023).",
      warranty:
        "2-year structural warranty on desks. " +
        "1-year warranty on chairs. No extended warranty available.",
      compliance:
        "CAC registered (RC-0554219). 1 completed office fit-out: law firm, 40 staff, 2023. " +
        "No independent EN standard certification provided.",
      evidence: JSON.stringify(["https://en.wikipedia.org/wiki/Office_furniture"]),
    },
    note: "Facilities — Supplier A expected winner (certified ergonomic, larger references, better warranty)",
  },
];

// ── Run one full round ────────────────────────────────────────────────────────

async function runRound(def, roundIndex) {
  const label = `ROUND ${roundIndex + 1}: ${def.title}`;
  step(label);
  console.log(`  Note: ${def.note}\n`);

  // 1. Create
  log(buyer, "Creating round + locking 1 GEN escrow…");
  await send(buyer, "create_round", [
    def.title,
    def.category,
    def.description,
    def.quantity,
    def.budgetMin,
    def.budgetMax,
    def.criteria,
    def.weights,
    def.mandatory,
    BID_DEADLINE(),
    APPEAL_WINDOW,
  ], ESCROW);

  await new Promise((r) => setTimeout(r, 4000));
  const stats   = await read("get_contract_stats");
  const roundId = Number(stats.total_rounds);
  log(buyer, `Round ID: ${roundId}`);

  const roundData = await read("get_round", [roundId]);
  log(buyer, `Escrow locked: ${roundData.escrow_deposited} wei`);

  // 2. Open
  log(buyer, "Opening round…");
  await send(buyer, "open_round", [roundId]);

  // 3. Bid A
  log(supplierA, "Submitting Bid A…");
  await send(supplierA, "submit_bid", [
    roundId,
    def.bidA.price,
    def.bidA.delivery,
    def.bidA.technical,
    def.bidA.warranty,
    def.bidA.compliance,
    def.bidA.evidence,
  ]);
  await new Promise((r) => setTimeout(r, 2000));
  const statsA = await read("get_contract_stats");
  const bidAId = Number(statsA.total_bids);
  log(supplierA, `Bid A ID: ${bidAId}`);

  // 4. Bid B
  log(supplierB, "Submitting Bid B…");
  await send(supplierB, "submit_bid", [
    roundId,
    def.bidB.price,
    def.bidB.delivery,
    def.bidB.technical,
    def.bidB.warranty,
    def.bidB.compliance,
    def.bidB.evidence,
  ]);
  await new Promise((r) => setTimeout(r, 2000));
  const statsB = await read("get_contract_stats");
  const bidBId = Number(statsB.total_bids);
  log(supplierB, `Bid B ID: ${bidBId}`);

  // 5. Close bids
  log(buyer, "Closing bid window…");
  await send(buyer, "close_bids", [roundId]);

  // 6. Request evaluation
  log(buyer, "Requesting validator consensus evaluation…");
  console.log("  (validators will fetch evidence URLs and run independent LLM checks — ~60-120s)\n");
  await send(buyer, "request_evaluation", [roundId]);

  // 7. Poll
  const evalResult = await pollEvaluation(roundId);
  if (!evalResult || !evalResult.verdict) {
    console.log(`\n⚠  Round ${roundId} evaluation timed out.`);
    console.log(`   Resume with: RESUME_ROUND_ID=${roundId} node scripts/e2e-test.mjs\n`);
    return;
  }

  // 8. Print result
  console.log("\n  ┌─────────────────────────────────────────────────────────┐");
  console.log(`  │  Verdict     : ${evalResult.verdict}`);
  console.log(`  │  Winner bid  : ${evalResult.recommended_bid_id}`);
  console.log(`  │  Winner addr : ${String(evalResult.recommended_supplier).slice(0, 20)}…`);
  console.log(`  │  Confidence  : ${evalResult.confidence}%`);
  console.log(`  │  Reason      : ${evalResult.short_reason}`);
  console.log("  └─────────────────────────────────────────────────────────┘\n");

  // 9. Close appeal window (no appeal)
  log(buyer, "Closing appeal window…");
  await send(buyer, "close_appeal_window", [roundId]);

  // 10. Finalize — releases escrow
  log(buyer, "Finalizing recommendation (escrow release)…");
  const pre = await read("get_round", [roundId]);
  log(buyer, `Escrow before finalize: ${pre.escrow_deposited} wei`);

  await send(buyer, "finalize_recommendation", [roundId]);

  const post = await read("get_round", [roundId]);
  log(buyer, `Escrow after finalize:  ${post.escrow_deposited} wei`);
  log(buyer, `Round status: ${post.status}`);

  const ok = (post.escrow_deposited ?? "0") === "0";
  console.log(`\n  Round ${roundId} complete — escrow released: ${ok ? "✓ YES" : "✗ NO"}`);
  console.log(`  Explorer: ${EXPLORER}/address/${CONTRACT}\n`);

  return roundId;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const start = process.env.START_ROUND ? Number(process.env.START_ROUND) - 1 : 0;
  const roundsToRun = ROUNDS.slice(start);

  console.log(`  Running ${roundsToRun.length} round(s) starting from round ${start + 1}\n`);

  const completed = [];
  for (let i = 0; i < roundsToRun.length; i++) {
    const id = await runRound(roundsToRun[i], start + i);
    if (id) completed.push(id);
  }

  step("ALL DONE");
  console.log(`  Completed rounds: ${completed.join(", ")}`);
  console.log(`  Explorer: ${EXPLORER}/address/${CONTRACT}`);
  console.log(`  Live app: https://procheck-theta.vercel.app\n`);
}

main().catch((err) => {
  console.error("\n❌  Fatal error:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
