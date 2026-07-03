import type { Bid } from "@/types";
import { parseEvidenceUrls, formatTimestamp } from "@/lib/utils";
import { SupplierBadge } from "./SupplierBadge";
import { ExternalLink, Clock, Package, ShieldCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface BidPacketPanelProps {
  bid: Bid;
  isRecommended?: boolean;
  rank?: number;
}

export function BidPacketPanel({ bid, isRecommended, rank }: BidPacketPanelProps) {
  const evidenceUrls = parseEvidenceUrls(bid.evidence_urls);

  return (
    <div
      className={cn(
        "panel p-5 transition-all",
        isRecommended && "border-award-gold/40 glow-gold"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {rank && (
            <div
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold",
                isRecommended
                  ? "bg-award-gold/20 text-award-gold border border-award-gold/40"
                  : "bg-deep-steel text-slate-grey border border-slate-grey/20"
              )}
            >
              {rank}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-slate-grey">BID #{bid.bid_id}</span>
              {isRecommended && (
                <span className="status-badge text-award-gold border-award-gold/30 bg-award-gold/10">
                  Recommended
                </span>
              )}
            </div>
            <SupplierBadge address={bid.supplier} size="sm" />
          </div>
        </div>
        <div className="text-right">
          <span className="label text-xs">Price</span>
          <p className="font-display font-bold text-xl text-paper-white">
            {bid.price.toLocaleString()}
          </p>
          <p className="font-mono text-xs text-slate-grey">GEN equivalent</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-deep-steel rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={12} className="text-ledger-cyan" />
            <span className="label text-xs">Delivery</span>
          </div>
          <p className="font-mono text-sm text-paper-white">{bid.delivery_timeline_days} days</p>
        </div>
        <div className="bg-deep-steel rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={12} className="text-slate-grey" />
            <span className="label text-xs">Submitted</span>
          </div>
          <p className="font-mono text-xs text-paper-white">{formatTimestamp(bid.submitted_at)}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Package size={12} className="text-ledger-cyan" />
            <span className="label text-xs">Technical Summary</span>
          </div>
          <p className="text-sm text-paper-white/80 leading-relaxed">{bid.technical_summary}</p>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Wrench size={12} className="text-ledger-cyan" />
            <span className="label text-xs">Warranty / Support</span>
          </div>
          <p className="text-sm text-paper-white/80">{bid.warranty_terms}</p>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldCheck size={12} className="text-compliance-green" />
            <span className="label text-xs">Compliance Statement</span>
          </div>
          <p className="text-sm text-paper-white/80">{bid.compliance_statement}</p>
        </div>

        {evidenceUrls.length > 0 && (
          <div>
            <span className="label text-xs block mb-2">Evidence URLs</span>
            <div className="space-y-1">
              {evidenceUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-mono text-ledger-cyan hover:text-paper-white transition-colors truncate"
                >
                  <ExternalLink size={10} className="shrink-0" />
                  {url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
