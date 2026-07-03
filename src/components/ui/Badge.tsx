import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "cyan" | "gold" | "green" | "red" | "grey";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-procurement-blue/20 text-ledger-cyan border-procurement-blue/30",
    cyan: "bg-ledger-cyan/10 text-ledger-cyan border-ledger-cyan/30",
    gold: "bg-award-gold/10 text-award-gold border-award-gold/30",
    green: "bg-compliance-green/10 text-compliance-green border-compliance-green/30",
    red: "bg-risk-red/10 text-risk-red border-risk-red/30",
    grey: "bg-slate-grey/10 text-slate-grey border-slate-grey/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
