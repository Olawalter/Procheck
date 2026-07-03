export interface ProcurementRound {
  round_id: number;
  buyer: string;
  title: string;
  category: string;
  description: string;
  quantity: string;
  budget_min: number;
  budget_max: number;
  criteria_text: string;
  criteria_weights: string; // JSON string
  mandatory_requirements: string; // JSON string
  bid_deadline: number; // unix timestamp
  appeal_window: number; // seconds
  status: RoundStatus;
  created_at: number;
  finalized: boolean;
  bid_ids: string; // JSON string
  bid_count?: number;
}

export type RoundStatus =
  | "draft"
  | "open_for_bids"
  | "bid_submission_closed"
  | "under_consensus_evaluation"
  | "recommendation_issued"
  | "appeal_window_open"
  | "appeal_under_review"
  | "finalized"
  | "awarded"
  | "cancelled"
  | "no_valid_bid"
  | "insufficient_evidence"
  | "manual_review_required"
  | "unverifiable";

export interface Bid {
  bid_id: number;
  round_id: number;
  supplier: string;
  price: number;
  delivery_timeline_days: number;
  technical_summary: string;
  warranty_terms: string;
  compliance_statement: string;
  evidence_urls: string; // JSON string
  submitted_at: number;
  revised_at: number;
  status: string;
}

export interface EvaluationResult {
  round_id: number;
  verdict: VerdictCategory;
  recommended_bid_id: number;
  recommended_supplier: string;
  confidence: number;
  quality_band: QualityBand;
  price_value_band: PriceValueBand;
  compliance_band: ComplianceBand;
  risk_band: RiskBand;
  reason_code: string;
  short_reason: string;
  appeal_allowed: boolean;
  issued_at: number;
}

export type VerdictCategory =
  | "award_recommended"
  | "no_valid_bid"
  | "tie_detected"
  | "insufficient_evidence"
  | "unverifiable"
  | "manual_review_required"
  | "appeal_granted"
  | "appeal_rejected";

export type QualityBand = "poor" | "weak" | "acceptable" | "strong" | "excellent";
export type PriceValueBand = "overpriced" | "questionable" | "fair" | "good_value" | "exceptional_value";
export type ComplianceBand = "non_compliant" | "weak" | "partial" | "strong" | "complete";
export type RiskBand = "high" | "medium" | "low" | "minimal";

export interface Appeal {
  appeal_id: number;
  round_id: number;
  filed_by: string;
  basis: AppealBasis;
  statement: string;
  evidence_urls: string; // JSON string
  status: string;
  result: string; // JSON string
  created_at: number;
}

export type AppealBasis =
  | "new_compliance_evidence"
  | "price_miscalculation"
  | "technical_spec_misread"
  | "delivery_timeline_misread"
  | "supplier_identity_error"
  | "evidence_url_misread"
  | "criteria_weighting_error"
  | "conflict_of_interest_claim";

export interface AppealResult {
  appeal_verdict: "appeal_granted" | "appeal_rejected" | "manual_review_required";
  final_recommendation_changed: boolean;
  new_recommended_bid_id: number;
  confidence: number;
  reason_code: string;
  short_reason: string;
}

export interface ContractStats {
  total_rounds: number;
  total_bids: number;
  total_appeals: number;
}

export interface CriteriaWeights {
  [key: string]: number;
}
