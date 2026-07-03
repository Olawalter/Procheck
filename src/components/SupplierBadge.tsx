import { formatAddress, getExplorerAddressUrl } from "@/lib/utils";
import { ExternalLink, UserCircle } from "lucide-react";

interface SupplierBadgeProps {
  address: string;
  label?: string;
  showLink?: boolean;
  size?: "sm" | "md";
}

export function SupplierBadge({ address, label, showLink = true, size = "md" }: SupplierBadgeProps) {
  const explorerUrl = getExplorerAddressUrl(address);
  const displayAddress = formatAddress(address, size === "sm" ? 4 : 6);

  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-procurement-blue/20 border border-procurement-blue/30 flex items-center justify-center">
        <UserCircle size={14} className="text-ledger-cyan" />
      </div>
      <div>
        {label && <p className="label text-xs mb-0">{label}</p>}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-paper-white">{displayAddress}</span>
          {showLink && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={10} className="text-slate-grey hover:text-ledger-cyan" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
