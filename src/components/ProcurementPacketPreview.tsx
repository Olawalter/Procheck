import type { ProcurementRound } from "@/types";
import { parseCriteriaWeights, parseMandatoryRequirements, getStatusLabel, getStatusColor, formatTimestamp } from "@/lib/utils";
import { CriteriaWeightGrid } from "./CriteriaWeightGrid";
import { ComplianceChecklist } from "./ComplianceChecklist";
import { cn } from "@/lib/utils";

interface ProcurementPacketPreviewProps {
  round: ProcurementRound;
}

export function ProcurementPacketPreview({ round }: ProcurementPacketPreviewProps) {
  return (
    <div className="panel p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-slate-grey">ROUND #{round.round_id}</span>
            <span className={cn("status-badge", getStatusColor(round.status))}>
              {getStatusLabel(round.status)}
            </span>
          </div>
          <h2 className="font-display font-bold text-xl text-paper-white">{round.title}</h2>
          <p className="text-sm text-slate-grey capitalize mt-0.5">
            {round.category.replace(/_/g, " ")}
          </p>
        </div>
        <div className="text-right">
          <span className="label text-xs block mb-1">Budget Range</span>
          <p className="font-mono text-sm text-paper-white">
            {round.budget_min.toLocaleString()} – {round.budget_max.toLocaleString()}
          </p>
          <p className="font-mono text-xs text-slate-grey">GEN equivalent</p>
        </div>
      </div>

      <div>
        <span className="label text-xs block mb-2">Description</span>
        <p className="text-sm text-paper-white/80 leading-relaxed">{round.description}</p>
      </div>

      {round.quantity && (
        <div>
          <span className="label text-xs block mb-1">Quantity / Scope</span>
          <p className="text-sm text-paper-white">{round.quantity}</p>
        </div>
      )}

      <div>
        <span className="label text-xs block mb-2">Evaluation Criteria & Weights</span>
        <CriteriaWeightGrid weightsJson={round.criteria_weights} />
      </div>

      <div>
        <span className="label text-xs block mb-2">Mandatory Requirements</span>
        <ComplianceChecklist requirementsJson={round.mandatory_requirements} />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-procurement-blue/10">
        <div>
          <span className="label text-xs block mb-1">Bid Deadline</span>
          <p className="font-mono text-xs text-paper-white">{formatTimestamp(round.bid_deadline)}</p>
        </div>
        <div>
          <span className="label text-xs block mb-1">Appeal Window</span>
          <p className="font-mono text-xs text-paper-white">
            {Math.floor(round.appeal_window / 3600)}h after evaluation
          </p>
        </div>
      </div>
    </div>
  );
}
