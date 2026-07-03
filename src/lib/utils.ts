import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RoundStatus, VerdictCategory, QualityBand, PriceValueBand, ComplianceBand, RiskBand } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars = 6): string {
  if (!address) return "";
  return `${address.slice(0, chars)}...${address.slice(-4)}`;
}

export function formatTimestamp(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

export function formatDeadline(ts: number): string {
  if (!ts) return "—";
  const now = Date.now() / 1000;
  const diff = ts - now;
  if (diff < 0) return "Expired";
  if (diff < 3600) return `${Math.floor(diff / 60)}m remaining`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h remaining`;
  return `${Math.floor(diff / 86400)}d remaining`;
}

export function isDeadlinePast(ts: number): boolean {
  return Date.now() / 1000 > ts;
}

export function parseCriteriaWeights(weightsJson: string): Record<string, number> {
  try {
    return JSON.parse(weightsJson) as Record<string, number>;
  } catch {
    return {};
  }
}

export function parseMandatoryRequirements(reqsJson: string): string[] {
  try {
    return JSON.parse(reqsJson) as string[];
  } catch {
    return [];
  }
}

export function parseEvidenceUrls(urlsJson: string): string[] {
  try {
    return JSON.parse(urlsJson) as string[];
  } catch {
    return [];
  }
}

export function getStatusColor(status: RoundStatus): string {
  const map: Record<string, string> = {
    draft: "text-slate-grey border-slate-grey/30 bg-slate-grey/10",
    open_for_bids: "text-compliance-green border-compliance-green/30 bg-compliance-green/10",
    bid_submission_closed: "text-ledger-cyan border-ledger-cyan/30 bg-ledger-cyan/10",
    under_consensus_evaluation: "text-award-gold border-award-gold/30 bg-award-gold/10",
    recommendation_issued: "text-procurement-blue border-procurement-blue/30 bg-procurement-blue/10",
    appeal_window_open: "text-award-gold border-award-gold/30 bg-award-gold/10",
    appeal_under_review: "text-award-gold border-award-gold/30 bg-award-gold/10",
    finalized: "text-compliance-green border-compliance-green/30 bg-compliance-green/10",
    awarded: "text-award-gold border-award-gold/30 bg-award-gold/10",
    cancelled: "text-risk-red border-risk-red/30 bg-risk-red/10",
    no_valid_bid: "text-risk-red border-risk-red/30 bg-risk-red/10",
    insufficient_evidence: "text-risk-red border-risk-red/30 bg-risk-red/10",
    manual_review_required: "text-award-gold border-award-gold/30 bg-award-gold/10",
    unverifiable: "text-risk-red border-risk-red/30 bg-risk-red/10",
  };
  return map[status] ?? "text-slate-grey border-slate-grey/30 bg-slate-grey/10";
}

export function getStatusLabel(status: RoundStatus): string {
  const map: Record<string, string> = {
    draft: "Draft",
    open_for_bids: "Open for Bids",
    bid_submission_closed: "Bids Closed",
    under_consensus_evaluation: "Evaluating",
    recommendation_issued: "Recommendation Ready",
    appeal_window_open: "Appeal Window",
    appeal_under_review: "Appeal Review",
    finalized: "Finalized",
    awarded: "Awarded",
    cancelled: "Cancelled",
    no_valid_bid: "No Valid Bid",
    insufficient_evidence: "Insufficient Evidence",
    manual_review_required: "Manual Review",
    unverifiable: "Unverifiable",
  };
  return map[status] ?? status;
}

export function getVerdictColor(verdict: VerdictCategory): string {
  const map: Record<string, string> = {
    award_recommended: "text-compliance-green",
    no_valid_bid: "text-risk-red",
    tie_detected: "text-award-gold",
    insufficient_evidence: "text-risk-red",
    unverifiable: "text-risk-red",
    manual_review_required: "text-award-gold",
    appeal_granted: "text-compliance-green",
    appeal_rejected: "text-risk-red",
  };
  return map[verdict] ?? "text-slate-grey";
}

export function getVerdictLabel(verdict: VerdictCategory): string {
  const map: Record<string, string> = {
    award_recommended: "Award Recommended",
    no_valid_bid: "No Valid Bid",
    tie_detected: "Tie Detected",
    insufficient_evidence: "Insufficient Evidence",
    unverifiable: "Unverifiable",
    manual_review_required: "Manual Review Required",
    appeal_granted: "Appeal Granted",
    appeal_rejected: "Appeal Rejected",
  };
  return map[verdict] ?? verdict;
}

export function getBandColor(band: string): string {
  const map: Record<string, string> = {
    // quality
    poor: "text-risk-red",
    weak: "text-orange-400",
    acceptable: "text-slate-grey",
    strong: "text-compliance-green",
    excellent: "text-ledger-cyan",
    // price
    overpriced: "text-risk-red",
    questionable: "text-orange-400",
    fair: "text-award-gold",
    good_value: "text-compliance-green",
    exceptional_value: "text-ledger-cyan",
    // compliance
    non_compliant: "text-risk-red",
    partial: "text-award-gold",
    complete: "text-compliance-green",
    // risk
    high: "text-risk-red",
    medium: "text-award-gold",
    low: "text-compliance-green",
    minimal: "text-ledger-cyan",
  };
  return map[band] ?? "text-slate-grey";
}

export function getBandLabel(band: string): string {
  return band
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function getExplorerTxUrl(hash: string): string {
  const base = process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL ?? "https://explorer-studio.genlayer.com";
  return `${base}/tx/${hash}`;
}

export function getExplorerAddressUrl(address: string): string {
  const base = process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL ?? "https://explorer-studio.genlayer.com";
  return `${base}/address/${address}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function extractError(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const msg = o.message ?? o.error ?? o.reason ?? o.details ?? o.shortMessage;
    if (msg) return String(msg);
    try { return JSON.stringify(err); } catch { return "[object]"; }
  }
  return String(err);
}
