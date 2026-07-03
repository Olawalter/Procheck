import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  leftIcon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-display font-semibold rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-procurement-blue text-paper-white hover:bg-blue-600 hover:shadow-[0_0_16px_rgba(29,78,216,0.4)]",
    secondary: "bg-transparent text-ledger-cyan border border-ledger-cyan/30 hover:bg-ledger-cyan/10 hover:border-ledger-cyan",
    ghost: "bg-transparent text-slate-grey hover:text-paper-white hover:bg-white/5",
    danger: "bg-transparent text-risk-red border border-risk-red/30 hover:bg-risk-red/10 hover:border-risk-red",
    gold: "bg-award-gold text-midnight-navy hover:bg-yellow-400 hover:shadow-[0_0_16px_rgba(245,184,65,0.4)]",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : leftIcon}
      {children}
    </button>
  );
}
