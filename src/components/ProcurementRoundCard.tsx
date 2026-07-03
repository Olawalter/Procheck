import Link from "next/link";
import type { ProcurementRound } from "@/types";
import { getStatusColor, getStatusLabel, formatAddress, formatDeadline } from "@/lib/utils";
import { Clock, Users, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcurementRoundCardProps {
  round: ProcurementRound;
}

export function ProcurementRoundCard({ round }: ProcurementRoundCardProps) {
  const statusClass = getStatusColor(round.status);
  const statusLabel = getStatusLabel(round.status);
  const bidCount = round.bid_count ?? (round.bid_ids ? JSON.parse(round.bid_ids).length : 0);

  return (
    <Link href={`/rounds/${round.round_id}`}>
      <div className="panel panel-hover cursor-pointer p-5 group">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-slate-grey">#{round.round_id}</span>
              <span
                className={cn(
                  "status-badge",
                  statusClass
                )}
              >
                {statusLabel}
              </span>
            </div>
            <h3 className="font-display font-semibold text-base text-paper-white group-hover:text-ledger-cyan transition-colors line-clamp-1">
              {round.title}
            </h3>
          </div>
          <ArrowRight
            size={16}
            className="text-slate-grey group-hover:text-ledger-cyan transition-colors shrink-0 mt-1"
          />
        </div>

        {round.description && (
          <p className="text-sm text-slate-grey line-clamp-2 mb-4">{round.description}</p>
        )}

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Users size={12} className="text-slate-grey" />
            <span className="font-mono text-xs text-paper-white">{bidCount} bid{bidCount !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-slate-grey" />
            <span className="font-mono text-xs text-paper-white">{formatDeadline(round.bid_deadline)}</span>
          </div>
          {round.buyer && (
            <div className="ml-auto">
              <span className="label text-xs">Buyer</span>
              <p className="font-mono text-xs text-paper-white">{formatAddress(round.buyer, 4)}</p>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-procurement-blue/10">
          <span className="text-xs text-slate-grey capitalize">
            {round.category.replace(/_/g, " ")}
          </span>
          {round.budget_min != null && round.budget_max != null && (
            <>
              <span className="text-slate-grey/40 mx-2">·</span>
              <span className="text-xs text-paper-white/60">
                {Number(round.budget_min).toLocaleString()} – {Number(round.budget_max).toLocaleString()} GEN
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
