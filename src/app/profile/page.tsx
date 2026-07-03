"use client";

import { useEffect, useState } from "react";
import { readContract } from "@/lib/genlayer";
import type { ProcurementRound, Bid } from "@/types";
import { useWallet } from "@/context/WalletContext";
import { Button } from "@/components/ui/Button";
import { ProcurementRoundCard } from "@/components/ProcurementRoundCard";
import { ExplorerLinkCard } from "@/components/ExplorerLinkCard";
import { getStatusColor, getStatusLabel, formatTimestamp } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { UserCircle, RefreshCw, Plus, Package } from "lucide-react";

export default function ProfilePage() {
  const { address, isConnected, connect, explorerUrl } = useWallet();
  const [myRounds, setMyRounds] = useState<ProcurementRound[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"rounds" | "bids">("rounds");

  const fetchProfile = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [rounds, bids] = await Promise.all([
        readContract<ProcurementRound[]>("get_rounds_by_buyer", [address]),
        readContract<Bid[]>("get_bids_by_supplier", [address]),
      ]);
      setMyRounds(Array.isArray(rounds) ? rounds.reverse() : []);
      setMyBids(Array.isArray(bids) ? bids.reverse() : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) fetchProfile();
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <UserCircle size={40} className="text-slate-grey mx-auto mb-4" />
        <h1 className="font-display font-bold text-2xl text-paper-white mb-2">
          Connect Your Wallet
        </h1>
        <p className="text-sm text-slate-grey mb-8">
          Connect to view your procurement rounds and submitted bids.
        </p>
        <Button onClick={connect} size="lg">
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl text-paper-white">Procurement Profile</h1>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-2 h-2 rounded-full bg-compliance-green animate-pulse-slow" />
            <span className="font-mono text-sm text-paper-white">{address}</span>
          </div>
        </div>
        <button
          onClick={fetchProfile}
          className="p-2 rounded-lg bg-deep-steel border border-procurement-blue/20 text-slate-grey hover:text-paper-white hover:border-ledger-cyan/40 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Rounds Created", value: myRounds.length, color: "text-ledger-cyan" },
          { label: "Bids Submitted", value: myBids.length, color: "text-compliance-green" },
          {
            label: "Wins",
            value: 0,
            color: "text-award-gold",
            note: "Track via evaluation results",
          },
        ].map(({ label, value, color, note }) => (
          <div key={label} className="panel p-5 text-center">
            <p className={`font-display font-bold text-3xl ${color}`}>{value}</p>
            <p className="label text-xs mt-1">{label}</p>
            {note && <p className="text-xs text-slate-grey/60 mt-1">{note}</p>}
          </div>
        ))}
      </div>

      {/* Explorer */}
      {explorerUrl && (
        <div className="mb-6">
          <ExplorerLinkCard label="Your Address on Explorer" address={address!} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("rounds")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-display font-semibold transition-colors",
            tab === "rounds"
              ? "bg-procurement-blue/20 text-ledger-cyan border border-procurement-blue/40"
              : "text-slate-grey border border-transparent hover:text-paper-white"
          )}
        >
          My Rounds ({myRounds.length})
        </button>
        <button
          onClick={() => setTab("bids")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-display font-semibold transition-colors",
            tab === "bids"
              ? "bg-procurement-blue/20 text-ledger-cyan border border-procurement-blue/40"
              : "text-slate-grey border border-transparent hover:text-paper-white"
          )}
        >
          My Bids ({myBids.length})
        </button>
      </div>

      {tab === "rounds" && (
        <div>
          {myRounds.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="font-display font-semibold text-paper-white mb-2">No rounds created yet</p>
              <p className="text-sm text-slate-grey mb-6">Create your first procurement round.</p>
              <Link href="/rounds/create">
                <Button leftIcon={<Plus size={14} />}>Create Round</Button>
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myRounds.map((r) => (
                <ProcurementRoundCard key={r.round_id} round={r} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "bids" && (
        <div>
          {myBids.length === 0 ? (
            <div className="panel p-8 text-center">
              <Package size={32} className="text-slate-grey mx-auto mb-3" />
              <p className="font-display font-semibold text-paper-white mb-2">No bids submitted yet</p>
              <p className="text-sm text-slate-grey mb-6">Browse open rounds and submit a proposal.</p>
              <Link href="/rounds">
                <Button variant="secondary">Browse Rounds</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myBids.map((bid) => (
                <Link key={bid.bid_id} href={`/rounds/${bid.round_id}`}>
                  <div className="panel panel-hover p-4 flex items-center gap-4 group cursor-pointer">
                    <div className="w-10 h-10 rounded-lg bg-deep-steel border border-procurement-blue/20 flex items-center justify-center shrink-0">
                      <Package size={16} className="text-ledger-cyan" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-grey">BID #{bid.bid_id}</span>
                        <span className="font-mono text-xs text-slate-grey">→ Round #{bid.round_id}</span>
                        <span
                          className={cn(
                            "status-badge",
                            getStatusColor(bid.status as never)
                          )}
                        >
                          {bid.status}
                        </span>
                      </div>
                      <p className="font-mono text-sm text-paper-white mt-0.5">
                        {Number(bid.price).toLocaleString()} GEN · {bid.delivery_timeline_days} days
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-grey">{formatTimestamp(bid.submitted_at)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
