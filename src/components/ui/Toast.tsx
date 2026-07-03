"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const iconMap = { success: CheckCircle2, error: AlertCircle, info: Info };
  const colorMap = {
    success: "border-compliance-green/40 bg-compliance-green/10 text-compliance-green",
    error: "border-risk-red/40 bg-risk-red/10 text-risk-red",
    info: "border-ledger-cyan/40 bg-ledger-cyan/10 text-ledger-cyan",
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => {
          const Icon = iconMap[t.type];
          return (
            <div
              key={t.id}
              className={cn(
                "panel flex items-start gap-3 p-4 animate-fade-in",
                colorMap[t.type]
              )}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-paper-white">{t.title}</p>
                {t.message && <p className="text-xs mt-0.5 text-slate-grey">{t.message}</p>}
              </div>
              <button onClick={() => remove(t.id)} className="text-slate-grey hover:text-paper-white">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
