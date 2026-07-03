import type { Bid } from "@/types";
import { cn } from "@/lib/utils";

interface BidComparisonMatrixProps {
  bids: Bid[];
  recommendedBidId?: number;
}

export function BidComparisonMatrix({ bids, recommendedBidId }: BidComparisonMatrixProps) {
  if (bids.length === 0) return null;

  const minPrice = Math.min(...bids.map((b) => b.price));
  const maxPrice = Math.max(...bids.map((b) => b.price));
  const minDays = Math.min(...bids.map((b) => b.delivery_timeline_days));
  const maxDays = Math.max(...bids.map((b) => b.delivery_timeline_days));

  const getPriceLabel = (bid: Bid) => {
    if (bids.length === 1) return "Only bid";
    if (bid.price === minPrice) return "Lowest";
    if (bid.price === maxPrice) return "Highest";
    return "Mid-range";
  };

  const getDeliveryLabel = (bid: Bid) => {
    if (bids.length === 1) return "Only bid";
    if (bid.delivery_timeline_days === minDays) return "Fastest";
    if (bid.delivery_timeline_days === maxDays) return "Slowest";
    return "Mid-range";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-procurement-blue/20">
            <th className="text-left py-2 pr-4 label text-xs font-semibold">Field</th>
            {bids.map((bid) => (
              <th
                key={bid.bid_id}
                className={cn(
                  "text-right py-2 px-3 font-display text-xs font-semibold",
                  bid.bid_id === recommendedBidId ? "text-award-gold" : "text-slate-grey"
                )}
              >
                BID #{bid.bid_id}
                {bid.bid_id === recommendedBidId && (
                  <span className="ml-1 text-award-gold">★</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-deep-steel">
            <td className="py-2.5 pr-4 label text-xs">Price (GEN)</td>
            {bids.map((bid) => (
              <td key={bid.bid_id} className="py-2.5 px-3 text-right">
                <span className="font-mono text-xs text-paper-white">
                  {bid.price.toLocaleString()}
                </span>
                <span
                  className={cn(
                    "ml-1.5 font-mono text-[10px]",
                    bid.price === minPrice ? "text-compliance-green" : bid.price === maxPrice ? "text-risk-red" : "text-slate-grey"
                  )}
                >
                  ({getPriceLabel(bid)})
                </span>
              </td>
            ))}
          </tr>
          <tr className="border-b border-deep-steel">
            <td className="py-2.5 pr-4 label text-xs">Delivery (days)</td>
            {bids.map((bid) => (
              <td key={bid.bid_id} className="py-2.5 px-3 text-right">
                <span className="font-mono text-xs text-paper-white">
                  {bid.delivery_timeline_days}
                </span>
                <span
                  className={cn(
                    "ml-1.5 font-mono text-[10px]",
                    bid.delivery_timeline_days === minDays ? "text-compliance-green" : "text-slate-grey"
                  )}
                >
                  ({getDeliveryLabel(bid)})
                </span>
              </td>
            ))}
          </tr>
          <tr className="border-b border-deep-steel">
            <td className="py-2.5 pr-4 label text-xs">Supplier</td>
            {bids.map((bid) => (
              <td key={bid.bid_id} className="py-2.5 px-3 text-right font-mono text-xs text-paper-white">
                {bid.supplier.slice(0, 6)}…{bid.supplier.slice(-4)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-2.5 pr-4 label text-xs">Evidence URLs</td>
            {bids.map((bid) => {
              const urls = JSON.parse(bid.evidence_urls || "[]") as string[];
              return (
                <td key={bid.bid_id} className="py-2.5 px-3 text-right font-mono text-xs text-paper-white">
                  {urls.length} item{urls.length !== 1 ? "s" : ""}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
