"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { readContract, writeContract, waitForTransaction } from "@/lib/genlayer";
import type { ProcurementRound, Bid, EvaluationResult } from "@/types";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { ConsensusAwardSeal } from "@/components/ConsensusAwardSeal";
import { ValueScoreRadar } from "@/components/ValueScoreRadar";
import { RiskBandMeter } from "@/components/RiskBandMeter";
import { BidComparisonMatrix } from "@/components/BidComparisonMatrix";
import { ExplorerLinkCard } from "@/components/ExplorerLinkCard";
import { getBandColor, getBandLabel } from "@/lib/utils";
import { ChevronRight, Zap, AlertCircle, RefreshCw, Info } from "lucide-react";
import { extractError } from "@/lib/utils";

export default function EvaluationPage() {
  const params = useParams();
  const roundId = Number(params.roundId);
  const { address, account, isConnected } = useWallet();
  const { showToast } = useToast();

  const [round, setRound] = useState<ProcurementRound | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
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
      }
    } catch (err) {
      showToast("error", "Failed to load", extractError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [roundId]);

  const isBuyer = address && round && round.buyer.toLowerCase() === address.toLowerCase();

  const requestEvaluation = async () => {
    if (!account) return;
    setEvaluating(true);
    try {
      const hash = await writeContract(account.privateKey, "request_evaluation", [roundId]);
      setTxHash(hash);
      showToast("info", "Evaluation requested", "GenLayer validators are comparing bids… This may take a minute.");
      await waitForTransaction(account.privateKey, hash as `0x${string}`);
      showToast("success", "Evaluation complete!");
      await fetchAll();
    } catch (err) {
      showToast("error", "Evaluation failed", extractError(err));
    } finally {
      setEvaluating(false);
    }
  };

  const BAND_ROWS = evaluation
    ? [
        { label: "Quality", value: evaluation.quality_band },
        { label: "Price Value", value: evaluation.price_value_band },
        { label: "Compliance", value: evaluation.compliance_band },
      ]
    : [];

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="panel h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-2 text-xs text-slate-grey mb-6">
        <Link href="/rounds" className="hover:text-ledger-cyan">Bid Board</Link>
        <ChevronRight size={12} />
        <Link href={`/rounds/${roundId}`} className="hover:text-ledger-cyan">Round #{roundId}</Link>
        <ChevronRight size={12} />
        <span className="text-paper-white">Consensus Evaluation</span>
        <button onClick={fetchAll} className="ml-auto text-slate-grey hover:text-paper-white">
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-paper-white">
          Consensus Evaluation Room
        </h1>
        {round && (
          <p className="text-sm text-slate-grey mt-1">
            {round.title} · {bids.length} bid{bids.length !== 1 ? "s" : ""} submitted
          </p>
        )}
      </div>

      {/* Request evaluation CTA */}
      {round?.status === "bid_submission_closed" && isBuyer && !evaluation && (
        <div className="panel border-procurement-blue/40 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-procurement-blue/20 flex items-center justify-center shrink-0">
              <Zap size={18} className="text-ledger-cyan" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-base text-paper-white mb-1">
                Ready for GenLayer Evaluation
              </h3>
              <p className="text-sm text-slate-grey mb-4">
                {bids.length} bid{bids.length !== 1 ? "s" : ""} submitted. GenLayer validators will compare all
                proposals against your criteria and weights, then reach consensus on the best-value bid.
              </p>

              <div className="panel p-3 border-award-gold/20 mb-4 flex items-start gap-2">
                <Info size={13} className="text-award-gold shrink-0 mt-0.5" />
                <p className="text-xs text-slate-grey">
                  This is a non-deterministic evaluation. Multiple validators independently assess
                  the bids and reach consensus through the Equivalence Principle.
                  The process may take 30–90 seconds.
                </p>
              </div>

              <Button
                onClick={requestEvaluation}
                loading={evaluating}
                disabled={bids.length === 0}
                leftIcon={<Zap size={14} />}
              >
                {evaluating ? "Validators evaluating…" : "Request GenLayer Evaluation"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {round?.status === "under_consensus_evaluation" && !evaluation && (
        <div className="panel border-award-gold/30 p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-award-gold/10 flex items-center justify-center">
              <Zap size={16} className="text-award-gold animate-pulse-slow" />
            </div>
            <div>
              <p className="font-display font-semibold text-paper-white">
                GenLayer validators are comparing bids…
              </p>
              <p className="text-xs text-slate-grey mt-0.5">This may take 30–90 seconds</p>
            </div>
            <button onClick={fetchAll} className="ml-auto">
              <RefreshCw size={14} className="text-slate-grey hover:text-paper-white animate-spin" />
            </button>
          </div>
        </div>
      )}

      {bids.length === 0 && (
        <div className="panel border-risk-red/20 p-5 mb-6 flex items-start gap-3">
          <AlertCircle size={16} className="text-risk-red shrink-0" />
          <p className="text-sm text-slate-grey">No bids have been submitted for this round.</p>
        </div>
      )}

      {evaluation && (
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <ConsensusAwardSeal
              verdict={evaluation.verdict}
              confidence={evaluation.confidence}
              reasonCode={evaluation.reason_code}
              shortReason={evaluation.short_reason}
              recommendedBidId={evaluation.recommended_bid_id}
            />

            <div className="panel p-5">
              <h3 className="label text-xs mb-4">Evaluation Bands</h3>
              <div className="space-y-3">
                {BAND_ROWS.map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-grey">{label}</span>
                    <span className={`font-mono text-xs font-semibold ${getBandColor(value)}`}>
                      {getBandLabel(value)}
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-procurement-blue/10">
                  <RiskBandMeter band={evaluation.risk_band} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel p-5">
              <h3 className="label text-xs mb-3">Value Score Radar</h3>
              <ValueScoreRadar evaluation={evaluation} />
            </div>

            {txHash && (
              <div className="panel p-4">
                <h3 className="label text-xs mb-2">On-Chain</h3>
                <ExplorerLinkCard label="Evaluation Transaction" hash={txHash} />
              </div>
            )}
          </div>
        </div>
      )}

      {bids.length > 0 && (
        <div className="panel p-5">
          <h3 className="font-display font-semibold text-sm text-paper-white mb-4">
            Bid Comparison Matrix
          </h3>
          <BidComparisonMatrix
            bids={bids}
            recommendedBidId={evaluation?.recommended_bid_id}
          />
        </div>
      )}
    </div>
  );
}
