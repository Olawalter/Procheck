"use client";

import { X, Download } from "lucide-react";
import type { EIP6963ProviderDetail } from "@/lib/wallet-types";

interface WalletSelectModalProps {
  wallets: EIP6963ProviderDetail[];
  open: boolean;
  onSelect: (wallet: EIP6963ProviderDetail | null) => void;
  onClose: () => void;
}

export function WalletSelectModal({ wallets, open, onSelect, onClose }: WalletSelectModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-navy/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="panel w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-lg text-paper-white">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="text-slate-grey hover:text-paper-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {wallets.length === 0 ? (
          <div className="text-center py-6">
            <Download size={32} className="text-slate-grey mx-auto mb-3" />
            <p className="font-display font-semibold text-paper-white mb-2">No wallet detected</p>
            <p className="text-sm text-slate-grey mb-5">
              Install a compatible EVM wallet to connect to GenLayer StudioNet.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-procurement-blue text-paper-white text-sm font-display font-semibold hover:bg-blue-600 transition-colors"
              >
                Install MetaMask
              </a>
              <a
                href="https://rabby.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-deep-steel border border-procurement-blue/30 text-paper-white text-sm font-display font-semibold hover:border-ledger-cyan/40 transition-colors"
              >
                Install Rabby
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-grey mb-3">
              {wallets.length} wallet{wallets.length > 1 ? "s" : ""} detected — select one to connect
            </p>
            {wallets.map((wallet) => (
              <button
                key={wallet.info.rdns}
                onClick={() => onSelect(wallet)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-deep-steel border border-procurement-blue/20 hover:border-ledger-cyan/40 hover:bg-procurement-blue/10 transition-all group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={wallet.info.icon}
                  alt={wallet.info.name}
                  className="w-9 h-9 rounded-lg shrink-0"
                />
                <span className="font-display font-semibold text-sm text-paper-white group-hover:text-ledger-cyan transition-colors">
                  {wallet.info.name}
                </span>
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-grey/60 text-center mt-4">
          Connect to GenLayer StudioNet (chain ID 61999)
        </p>
      </div>
    </div>
  );
}
