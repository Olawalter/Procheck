"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { readContract, writeContract, waitForTransaction } from "@/lib/genlayer";
import type { ProcurementRound, EvaluationResult, Appeal, AppealResult } from "@/types";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { AppealDesk } from "@/components/AppealDesk";
import { ConsensusAwardSeal } from "@/components/ConsensusAwardSeal";
import { ExplorerLinkCard } from "@/components/ExplorerLinkCard";
import { getVerdictColor, getVerdictLabel } from "@/lib/utils";
import { ChevronRight, Scale, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { extractError } from "@/lib/utils";

export default function AppealPage() {
  const params = useParams();
  const router = useRouter();
  const roundId = Number(params.roundId);
  const { address, account, isConnected } = useWallet();
  const { showToast } = useToast();

  const [round, setRound] = useState<ProcurementRound | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [roundData, evalData, appealData] = await Promise.all([
        readContract<ProcurementRound>("get_round", [roundId]),
        readContract<EvaluationResult | Record<string, never>>("get_evaluation_result", [roundId]),
        readContract<Appeal | Record<string, never>>("get_appeal", [roundId]),
      ]);
      setRound(roundData);
      if (evalData && "verdict" in evalData) setEvaluation(evalData as EvaluationResult);
      if (appealData && "appeal_id" in appealData) setAppeal(appealData as Appeal);
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

  const requestAppealReview = async () => {
    if (!account) return;
    setReviewing(true);
    try {
      const hash = await writeContract(account.privateKey, "request_appeal_review", [roundId]);
      setTxHash(hash);
      showToast("info", "Appeal review requested", "Validators are reviewing…");
      await waitForTransaction(account.privateKey, hash as `0x${string}`);
      showToast("success", "Appeal review complete!");
      await fetchAll();
    } catch (err) {
      showToast("error", "Review failed", extractError(err));
    } finally {
      setReviewing(false);
    }
  };

  const appealResult: AppealResult | null = appeal?.result
    ? (() => {
        try {
          return JSON.parse(appeal.result) as AppealResult;
        } catch {
          return null;
        }
      })()
    : null;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="panel h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-2 text-xs text-slate-grey mb-6">
        <Link href="/rounds" className="hover:text-ledger-cyan">Bid Board</Link>
        <ChevronRight size={12} />
        <Link href={`/rounds/${roundId}`} className="hover:text-ledger-cyan">Round #{roundId}</Link>
        <ChevronRight size={12} />
        <span className="text-paper-white">Appeal Desk</span>
        <button onClick={fetchAll} className="ml-auto text-slate-grey hover:text-paper-white">
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Scale size={20} className="text-award-gold" />
        <div>
          <h1 className="font-display font-bold text-2xl text-paper-white">Appeal Desk</h1>
          {round && (
            <p className="text-sm text-slate-grey mt-0.5">{round.title}</p>
          )}
        </div>
      </div>

      {/* Original evaluation summary */}
      {evaluation && (
        <div className="mb-6">
          <h3 className="label text-xs mb-3">Original Consensus Result</h3>
          <ConsensusAwardSeal
            verdict={evaluation.verdict}
            confidence={evaluation.confidence}
            reasonCode={evaluation.reason_code}
            shortReason={evaluation.short_reason}
            recommendedBidId={evaluation.recommended_bid_id}
          />
        </div>
      )}

      {/* Existing appeal */}
      {appeal && (
        <div className="panel p-6 mb-6 border-award-gold/20">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-base text-paper-white">
                Appeal Filed
              </h3>
              <p className="text-xs text-slate-grey mt-0.5">
                Basis:{" "}
                <span className="font-mono text-paper-white">
                  {appeal.basis.replace(/_/g, " ")}
                </span>
              </p>
            </div>
            <span
              className={`status-badge ${
                appeal.status === "reviewed"
                  ? "text-compliance-green border-compliance-green/30 bg-compliance-green/10"
                  : "text-award-gold border-award-gold/30 bg-award-gold/10"
              }`}
            >
              {appeal.status}
            </span>
          </div>

          <div className="bg-deep-steel rounded-lg p-4 mb-4">
            <p className="text-sm text-paper-white/80 leading-relaxed">{appeal.statement}</p>
          </div>

          {/* Appeal result */}
          {appealResult && (
            <div
              className={`panel p-4 mt-4 ${
                appealResult.appeal_verdict === "appeal_granted"
                  ? "border-compliance-green/40"
                  : "border-risk-red/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {appealResult.appeal_verdict === "appeal_granted" ? (
                  <CheckCircle2 size={16} className="text-compliance-green" />
                ) : (
                  <XCircle size={16} className="text-risk-red" />
                )}
                <span
                  className={`font-display font-bold text-sm ${
                    appealResult.appeal_verdict === "appeal_granted"
                      ? "text-compliance-green"
                      : "text-risk-red"
                  }`}
                >
                  {getVerdictLabel(appealResult.appeal_verdict as never)}
                </span>
              </div>
              <p className="text-sm text-paper-white/80">{appealResult.short_reason}</p>
              {appealResult.final_recommendation_changed && (
                <p className="text-xs text-compliance-green mt-2">
                  ✓ Recommendation changed to Bid #{appealResult.new_recommended_bid_id}
                </p>
              )}
            </div>
          )}

          {/* Buyer can request review */}
          {isBuyer && appeal.status === "filed" && round?.status === "appeal_under_review" && (
            <div className="mt-4">
              <Button
                onClick={requestAppealReview}
                loading={reviewing}
                className="w-full"
                variant="secondary"
              >
                Request Appeal Review from Validators
              </Button>
            </div>
          )}
        </div>
      )}

      {/* File new appeal */}
      {!appeal && round?.status === "appeal_window_open" && isConnected && (
        <AppealDesk roundId={roundId} onSuccess={fetchAll} />
      )}

      {!appeal && round?.status !== "appeal_window_open" && (
        <div className="panel p-6 text-center border-slate-grey/20">
          <Scale size={24} className="text-slate-grey mx-auto mb-2" />
          <p className="font-display font-semibold text-sm text-paper-white mb-1">
            Appeal Window {round?.status === "finalized" ? "Closed" : "Not Yet Open"}
          </p>
          <p className="text-xs text-slate-grey">
            Appeals can only be filed during the appeal window after evaluation.
          </p>
        </div>
      )}

      {txHash && (
        <div className="panel p-4 mt-4">
          <h3 className="label text-xs mb-2">On-Chain</h3>
          <ExplorerLinkCard label="Appeal Transaction" hash={txHash} />
        </div>
      )}
    </div>
  );
}
