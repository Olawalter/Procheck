"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { readContract, writeContract, waitForTransaction } from "@/lib/genlayer";
import type { ProcurementRound, Bid, EvaluationResult } from "@/types";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { ProcurementPacketPreview } from "@/components/ProcurementPacketPreview";
import { BidPacketPanel } from "@/components/BidPacketPanel";
import { BidComparisonMatrix } from "@/components/BidComparisonMatrix";
import { AwardTrailTimeline } from "@/components/AwardTrailTimeline";
import { ConsensusAwardSeal } from "@/components/ConsensusAwardSeal";
import { ExplorerLinkCard } from "@/components/ExplorerLinkCard";
import { RefreshCw, ChevronRight, AlertCircle } from "lucide-react";
import { extractError } from "@/lib/utils";

export default function RoundDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roundId = Number(params.roundId);
  const { address, provider, isConnected } = useWallet();
  const { showToast } = useToast();

  const [round, setRound] = useState<ProcurementRound | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [roundData, bidsData, evalData] = await Promise.all([
        readContract<ProcurementRound>("get_round", [roundId]),
        readContract<Bid[]>("get_round_bids", [roundId]),
        readContract<EvaluationResult | Record<string, never>>("get_evaluation_result", [roundId]),
      ]);
      setRound(roundData);
      setBids(Array.isArray(bidsData) ? bidsData : []);
      if (evalData && "verdict" in evalData) {
        setEvaluation(evalData as EvaluationResult);
      } else {
        setEvaluation(null);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [roundId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isBuyer = address && round && round.buyer.toLowerCase() === address.toLowerCase();

  const doAction = async (fn: string, args: unknown[], successMsg: string) => {
    if (!provider) return;
    setActionLoading(true);
    try {
      const hash = await writeContract(provider, fn, args);
      setLastTx(hash);
      showToast("info", "Transaction submitted", "Waiting for confirmation…");
      await waitForTransaction(hash);
      showToast("success", successMsg);
      await fetchAll();
    } catch (err) {
      showToast("error", "Action failed", extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 panel p-6 animate-pulse h-64" />
          <div className="panel p-6 animate-pulse h-64" />
        </div>
      </div>
    );
  }

  if (error || !round) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="panel border-risk-red/30 p-6 flex items-start gap-3">
          <AlertCircle size={18} className="text-risk-red shrink-0" />
          <div>
            <p className="font-display font-semibold text-risk-red">Round not found</p>
            <p className="text-xs text-slate-grey mt-1">{error}</p>
            <Link href="/rounds" className="text-xs text-ledger-cyan mt-2 inline-block">
              ← Back to Bid Board
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-grey mb-6">
        <Link href="/rounds" className="hover:text-ledger-cyan">Bid Board</Link>
        <ChevronRight size={12} />
        <span className="text-paper-white">Round #{roundId}</span>
        <button onClick={fetchAll} className="ml-auto text-slate-grey hover:text-paper-white">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <ProcurementPacketPreview round={round} />

          {/* Buyer actions */}
          {isBuyer && (
            <div className="panel p-5">
              <h3 className="font-display font-semibold text-sm text-paper-white mb-3">Buyer Actions</h3>
              <div className="flex flex-wrap gap-2">
                {round.status === "draft" && (
                  <Button
                    size="sm"
                    loading={actionLoading}
                    onClick={() => doAction("open_round", [roundId], "Round opened for bids")}
                  >
                    Open for Bids
                  </Button>
                )}
                {round.status === "open_for_bids" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={actionLoading}
                    onClick={() => doAction("close_bids", [roundId], "Bids closed")}
                  >
                    Close Bids
                  </Button>
                )}
                {round.status === "bid_submission_closed" && (
                  <Link href={`/rounds/${roundId}/evaluation`}>
                    <Button size="sm" loading={actionLoading}>
                      Request Evaluation
                    </Button>
                  </Link>
                )}
                {round.status === "appeal_window_open" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={actionLoading}
                    onClick={() => doAction("close_appeal_window", [roundId], "Appeal window closed")}
                  >
                    Close Appeal Window
                  </Button>
                )}
                {round.status === "recommendation_issued" && (
                  <Button
                    size="sm"
                    variant="gold"
                    loading={actionLoading}
                    onClick={() => doAction("finalize_recommendation", [roundId], "Recommendation finalized")}
                  >
                    Finalize Recommendation
                  </Button>
                )}
                {(round.status === "draft" || round.status === "open_for_bids") && bids.length === 0 && (
                  <Button
                    size="sm"
                    variant="danger"
                    loading={actionLoading}
                    onClick={() => doAction("cancel_round", [roundId], "Round cancelled")}
                  >
                    Cancel Round
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Supplier action */}
          {round.status === "open_for_bids" && isConnected && !isBuyer && (
            <div className="panel p-5 border-compliance-green/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-sm text-paper-white">Submit Your Proposal</p>
                  <p className="text-xs text-slate-grey mt-0.5">Round is accepting bids</p>
                </div>
                <Link href={`/rounds/${roundId}/submit-bid`}>
                  <Button size="sm" variant="secondary">Submit Bid</Button>
                </Link>
              </div>
            </div>
          )}

          {/* Evaluation result */}
          {evaluation && (
            <div>
              <h3 className="font-display font-semibold text-sm text-slate-grey mb-3 uppercase tracking-wider">
                Consensus Evaluation
              </h3>
              <ConsensusAwardSeal
                verdict={evaluation.verdict}
                confidence={evaluation.confidence}
                reasonCode={evaluation.reason_code}
                shortReason={evaluation.short_reason}
                recommendedBidId={evaluation.recommended_bid_id}
              />

              {round.status === "appeal_window_open" && isConnected && !isBuyer && (
                <div className="mt-3">
                  <Link href={`/rounds/${roundId}/appeal`}>
                    <Button variant="secondary" size="sm" className="w-full">
                      File an Appeal
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Bids */}
          {bids.length > 0 && (
            <div>
              <h3 className="font-display font-semibold text-sm text-slate-grey mb-3 uppercase tracking-wider">
                Submitted Bids ({bids.length})
              </h3>

              {bids.length > 1 && evaluation && (
                <div className="panel p-5 mb-4">
                  <h4 className="label text-xs mb-3">Bid Comparison Matrix</h4>
                  <BidComparisonMatrix
                    bids={bids}
                    recommendedBidId={evaluation.recommended_bid_id}
                  />
                </div>
              )}

              <div className="space-y-4">
                {bids.map((bid, i) => (
                  <BidPacketPanel
                    key={bid.bid_id}
                    bid={bid}
                    rank={i + 1}
                    isRecommended={evaluation?.recommended_bid_id === bid.bid_id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="panel p-5">
            <h3 className="font-display font-semibold text-sm text-paper-white mb-4">Round Trail</h3>
            <AwardTrailTimeline currentStatus={round.status} />
          </div>

          {/* Escrow status */}
          {(round.escrow_amount ?? 0) > 0 && (
            <div className="panel p-4 border-award-gold/30">
              <h3 className="label text-xs mb-2">GEN Escrow</h3>
              <p className="font-display font-bold text-award-gold text-lg">
                {(Number(round.escrow_amount) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 4 })} GEN
              </p>
              <p className="text-xs text-slate-grey mt-1">
                {round.status === "finalized"
                  ? "Released to winning supplier"
                  : "Locked onchain — released to winner on finalization"}
              </p>
            </div>
          )}

          {lastTx && (
            <div className="panel p-4">
              <h3 className="label text-xs mb-3">On-Chain</h3>
              <div className="space-y-2">
                <ExplorerLinkCard label="Latest Transaction" hash={lastTx} />
                {process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS && (
                  <ExplorerLinkCard
                    label="Contract"
                    address={process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS}
                  />
                )}
              </div>
            </div>
          )}

          <div className="panel p-4 space-y-2">
            {round.status === "open_for_bids" && (
              <Link href={`/rounds/${roundId}/submit-bid`} className="block">
                <Button variant="secondary" size="sm" className="w-full">Submit Bid</Button>
              </Link>
            )}
            <Link href={`/rounds/${roundId}/evaluation`} className="block">
              <Button variant="ghost" size="sm" className="w-full">View Evaluation Room</Button>
            </Link>
            {evaluation?.appeal_allowed && (
              <Link href={`/rounds/${roundId}/appeal`} className="block">
                <Button variant="ghost" size="sm" className="w-full">Appeal Desk</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
