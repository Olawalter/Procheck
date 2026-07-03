import type { VerdictCategory } from "@/types";
import { getVerdictLabel, getVerdictColor } from "@/lib/utils";
import { Award, XCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConsensusAwardSealProps {
  verdict: VerdictCategory;
  confidence: number;
  reasonCode: string;
  shortReason: string;
  recommendedBidId?: number;
}

export function ConsensusAwardSeal({
  verdict,
  confidence,
  reasonCode,
  shortReason,
  recommendedBidId,
}: ConsensusAwardSealProps) {
  const isWinner = verdict === "award_recommended";
  const isRejected = ["no_valid_bid", "insufficient_evidence", "unverifiable"].includes(verdict);
  const isTie = verdict === "tie_detected";

  const Icon = isWinner ? Award : isRejected ? XCircle : isTie ? AlertTriangle : HelpCircle;
  const colorClass = getVerdictColor(verdict);

  return (
    <div
      className={cn(
        "panel p-6 relative overflow-hidden",
        isWinner && "border-award-gold/40 glow-gold",
        isRejected && "border-risk-red/30",
        isTie && "border-award-gold/30"
      )}
    >
      {isWinner && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-award-gold to-transparent" />
      )}

      <div className="flex items-start gap-4">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
            isWinner ? "bg-award-gold/20" : isRejected ? "bg-risk-red/20" : "bg-award-gold/10"
          )}
        >
          <Icon size={22} className={colorClass} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className={cn("font-display font-bold text-lg", colorClass)}>
              {getVerdictLabel(verdict)}
            </h3>
            {isWinner && recommendedBidId && (
              <span className="font-mono text-xs bg-award-gold/10 text-award-gold border border-award-gold/30 px-2 py-0.5 rounded">
                BID #{recommendedBidId}
              </span>
            )}
          </div>

          <p className="text-sm text-paper-white/80 mb-3 leading-relaxed">{shortReason}</p>

          <div className="flex items-center gap-4">
            <div>
              <span className="label text-xs block mb-0.5">Confidence</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-deep-steel rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      confidence >= 80
                        ? "bg-compliance-green"
                        : confidence >= 60
                        ? "bg-award-gold"
                        : "bg-risk-red"
                    )}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-paper-white">{confidence}%</span>
              </div>
            </div>

            <div>
              <span className="label text-xs block mb-0.5">Reason Code</span>
              <span className="font-mono text-xs text-slate-grey">{reasonCode}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
