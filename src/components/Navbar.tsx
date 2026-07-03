"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { formatAddress, getExplorerAddressUrl } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ExternalLink, Scale, Menu, X, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/rounds", label: "Bid Board" },
  { href: "/rounds/create", label: "Create Round" },
  { href: "/profile", label: "Profile" },
];

export function Navbar() {
  const {
    address,
    isConnecting,
    isConnected,
    isWrongNetwork,
    connect,
    disconnect,
    switchNetwork,
    explorerUrl,
  } = useWallet();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-procurement-blue/20 bg-midnight-navy/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-procurement-blue/20 border border-procurement-blue/40 flex items-center justify-center group-hover:border-ledger-cyan/40 transition-colors">
                <Scale size={16} className="text-ledger-cyan" />
              </div>
              <div>
                <span className="font-accent text-base text-paper-white">Procurement</span>
                <span className="font-accent text-base text-ledger-cyan ml-1.5">Consensus</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-display font-medium transition-colors",
                    pathname.startsWith(link.href)
                      ? "bg-procurement-blue/20 text-ledger-cyan"
                      : "text-slate-grey hover:text-paper-white hover:bg-white/5"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Wallet */}
            <div className="hidden md:flex items-center gap-3">
              {isConnected && address ? (
                <div className="flex items-center gap-2">
                  {isWrongNetwork ? (
                    <button
                      onClick={switchNetwork}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-risk-red/10 border border-risk-red/40 text-risk-red text-xs font-display font-semibold hover:bg-risk-red/20 transition-colors"
                    >
                      <AlertTriangle size={12} />
                      Wrong Network
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-deep-steel border border-procurement-blue/20">
                      <div className="w-2 h-2 rounded-full bg-compliance-green animate-pulse-slow" />
                      <span className="font-mono text-xs text-paper-white">{formatAddress(address)}</span>
                      {explorerUrl && (
                        <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={12} className="text-slate-grey hover:text-ledger-cyan" />
                        </a>
                      )}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={disconnect}>
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button size="sm" loading={isConnecting} onClick={connect}>
                  Connect Wallet
                </Button>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden text-slate-grey hover:text-paper-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Wrong network banner */}
        {isConnected && isWrongNetwork && (
          <div className="border-t border-risk-red/30 bg-risk-red/10 px-4 py-2 flex items-center justify-center gap-3 text-xs">
            <AlertTriangle size={12} className="text-risk-red shrink-0" />
            <span className="text-risk-red">
              Wrong network — this app runs on GenLayer StudioNet (chain ID 61999)
            </span>
            <button
              onClick={switchNetwork}
              className="text-xs font-display font-semibold text-paper-white underline hover:text-ledger-cyan transition-colors"
            >
              Switch Network
            </button>
          </div>
        )}
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-b border-procurement-blue/20 bg-panel-graphite px-4 py-4 flex flex-col gap-3 z-30 relative">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-display",
                pathname.startsWith(link.href)
                  ? "bg-procurement-blue/20 text-ledger-cyan"
                  : "text-slate-grey"
              )}
            >
              {link.label}
            </Link>
          ))}
          {isConnected && address ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-compliance-green" />
                <span className="font-mono text-xs text-paper-white">{formatAddress(address)}</span>
              </div>
              {isWrongNetwork && (
                <button
                  onClick={switchNetwork}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-risk-red/10 border border-risk-red/30 text-risk-red text-xs font-display font-semibold"
                >
                  <AlertTriangle size={12} />
                  Switch to StudioNet
                </button>
              )}
            </div>
          ) : (
            <Button size="sm" loading={isConnecting} onClick={connect}>
              Connect Wallet
            </Button>
          )}
        </div>
      )}
    </>
  );
}
