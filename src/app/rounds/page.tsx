"use client";

import { useEffect, useState } from "react";
import { readContract } from "@/lib/genlayer";
import type { ProcurementRound } from "@/types";
import { ProcurementRoundCard } from "@/components/ProcurementRoundCard";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { RefreshCw, Plus, AlertCircle } from "lucide-react";
import { extractError } from "@/lib/utils";

export default function RoundsPage() {
  const [rounds, setRounds] = useState<ProcurementRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const fetchRounds = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await readContract<ProcurementRound[]>("get_all_rounds", []);
      setRounds(Array.isArray(data) ? data.reverse() : []);
    } catch (err) {
      const msg = extractError(err);
      if (msg.includes("not configured")) {
        setError("Contract address not set. Deploy the contract and update NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS in .env.local");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRounds();
  }, []);

  const filtered =
    filter === "all"
      ? rounds
      : rounds.filter((r) => {
          if (filter === "open") return r.status === "open_for_bids";
          if (filter === "evaluating") return ["under_consensus_evaluation", "recommendation_issued", "appeal_window_open"].includes(r.status);
          if (filter === "finalized") return ["finalized", "awarded"].includes(r.status);
          return true;
        });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl text-paper-white">Procurement Bid Board</h1>
          <p className="text-sm text-slate-grey mt-1">
            {rounds.length} round{rounds.length !== 1 ? "s" : ""} on-chain
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchRounds}
            className="p-2 rounded-lg bg-deep-steel border border-procurement-blue/20 text-slate-grey hover:text-paper-white hover:border-ledger-cyan/40 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <Link href="/rounds/create">
            <Button leftIcon={<Plus size={14} />}>Create Round</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {["all", "open", "evaluating", "finalized"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-colors capitalize ${
              filter === f
                ? "bg-procurement-blue/20 text-ledger-cyan border border-procurement-blue/40"
                : "bg-deep-steel text-slate-grey border border-transparent hover:text-paper-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div className="panel border-risk-red/30 p-5 mb-6 flex items-start gap-3">
          <AlertCircle size={16} className="text-risk-red shrink-0 mt-0.5" />
          <div>
            <p className="font-display font-semibold text-sm text-risk-red">Cannot load rounds</p>
            <p className="text-xs text-slate-grey mt-1">{error}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="panel p-5 h-48 animate-pulse">
              <div className="h-3 bg-deep-steel rounded w-1/3 mb-3" />
              <div className="h-5 bg-deep-steel rounded w-2/3 mb-2" />
              <div className="h-3 bg-deep-steel rounded w-full mb-1" />
              <div className="h-3 bg-deep-steel rounded w-4/5" />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="text-center py-20 panel">
          <p className="font-display font-semibold text-lg text-paper-white mb-2">No rounds found</p>
          <p className="text-sm text-slate-grey mb-6">Be the first to create a procurement round.</p>
          <Link href="/rounds/create">
            <Button leftIcon={<Plus size={14} />}>Create Procurement Round</Button>
          </Link>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((round) => (
            <ProcurementRoundCard key={round.round_id} round={round} />
          ))}
        </div>
      )}
    </div>
  );
}
