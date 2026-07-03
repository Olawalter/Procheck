import type { RoundStatus } from "@/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface TimelineStep {
  id: RoundStatus;
  label: string;
  description: string;
}

const STEPS: TimelineStep[] = [
  { id: "draft", label: "Draft", description: "Round configured by buyer" },
  { id: "open_for_bids", label: "Open for Bids", description: "Suppliers submit proposals" },
  { id: "bid_submission_closed", label: "Bids Closed", description: "Submission deadline reached" },
  { id: "under_consensus_evaluation", label: "Evaluating", description: "GenLayer validators comparing proposals" },
  { id: "appeal_window_open", label: "Appeal Window", description: "Parties may file structured appeals" },
  { id: "recommendation_issued", label: "Recommendation", description: "Canonical award recommendation stored" },
  { id: "finalized", label: "Finalized", description: "Buyer accepted recommendation" },
];

const STATUS_ORDER: Record<string, number> = {
  draft: 0,
  open_for_bids: 1,
  bid_submission_closed: 2,
  under_consensus_evaluation: 3,
  appeal_window_open: 4,
  appeal_under_review: 4,
  recommendation_issued: 5,
  finalized: 6,
  awarded: 6,
};

interface AwardTrailTimelineProps {
  currentStatus: RoundStatus;
}

export function AwardTrailTimeline({ currentStatus }: AwardTrailTimelineProps) {
  const currentOrder = STATUS_ORDER[currentStatus] ?? 0;

  return (
    <div className="relative">
      <div className="absolute left-3.5 top-3 bottom-3 w-px bg-procurement-blue/20" />
      <div className="space-y-4">
        {STEPS.map((step, i) => {
          const stepOrder = STATUS_ORDER[step.id] ?? i;
          const isDone = currentOrder > stepOrder;
          const isActive = currentOrder === stepOrder;

          return (
            <div key={step.id} className="flex items-start gap-4 relative">
              <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center z-10 bg-midnight-navy">
                {isDone ? (
                  <CheckCircle2 size={16} className="text-compliance-green" />
                ) : isActive ? (
                  <div className="w-7 h-7 rounded-full bg-procurement-blue/20 border border-procurement-blue flex items-center justify-center">
                    {currentStatus === "under_consensus_evaluation" ? (
                      <Loader2 size={12} className="text-ledger-cyan animate-spin" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-ledger-cyan" />
                    )}
                  </div>
                ) : (
                  <Circle size={14} className="text-slate-grey/30" />
                )}
              </div>
              <div className={cn("pt-0.5", isDone || isActive ? "" : "opacity-40")}>
                <p
                  className={cn(
                    "font-display font-semibold text-sm",
                    isDone ? "text-compliance-green" : isActive ? "text-ledger-cyan" : "text-slate-grey"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-slate-grey mt-0.5">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
