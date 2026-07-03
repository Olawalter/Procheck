import { ExternalLink } from "lucide-react";
import { getExplorerTxUrl, getExplorerAddressUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ExplorerLinkCardProps {
  label: string;
  hash?: string;
  address?: string;
  className?: string;
}

export function ExplorerLinkCard({ label, hash, address, className }: ExplorerLinkCardProps) {
  const url = hash ? getExplorerTxUrl(hash) : address ? getExplorerAddressUrl(address) : null;
  const display = hash ?? address ?? "";

  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg",
        "bg-deep-steel border border-procurement-blue/20 hover:border-ledger-cyan/40",
        "transition-colors group",
        className
      )}
    >
      <div className="min-w-0">
        <p className="label text-xs mb-0.5">{label}</p>
        <p className="font-mono text-xs text-paper-white truncate">
          {display.slice(0, 12)}…{display.slice(-6)}
        </p>
      </div>
      <ExternalLink
        size={14}
        className="text-slate-grey group-hover:text-ledger-cyan shrink-0 transition-colors"
      />
    </a>
  );
}
