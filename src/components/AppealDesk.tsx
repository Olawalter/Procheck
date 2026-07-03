"use client";

import { useState } from "react";
import type { AppealBasis } from "@/types";
import { Button } from "@/components/ui/Button";
import { writeContract, waitForTransaction } from "@/lib/genlayer";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/components/ui/Toast";
import { Scale, Plus, Minus } from "lucide-react";
import { extractError } from "@/lib/utils";

const APPEAL_BASES: { value: AppealBasis; label: string }[] = [
  { value: "new_compliance_evidence", label: "New Compliance Evidence" },
  { value: "price_miscalculation", label: "Price Miscalculation" },
  { value: "technical_spec_misread", label: "Technical Spec Misread" },
  { value: "delivery_timeline_misread", label: "Delivery Timeline Misread" },
  { value: "supplier_identity_error", label: "Supplier Identity Error" },
  { value: "evidence_url_misread", label: "Evidence URL Misread" },
  { value: "criteria_weighting_error", label: "Criteria Weighting Error" },
  { value: "conflict_of_interest_claim", label: "Conflict of Interest" },
];

interface AppealDeskProps {
  roundId: number;
  onSuccess?: () => void;
}

export function AppealDesk({ roundId, onSuccess }: AppealDeskProps) {
  const { provider, isConnected } = useWallet();
  const { showToast } = useToast();
  const [basis, setBasis] = useState<AppealBasis>("new_compliance_evidence");
  const [statement, setStatement] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);

  const addUrl = () => setEvidenceUrls((prev) => [...prev, ""]);
  const removeUrl = (i: number) => setEvidenceUrls((prev) => prev.filter((_, idx) => idx !== i));
  const updateUrl = (i: number, val: string) =>
    setEvidenceUrls((prev) => prev.map((u, idx) => (idx === i ? val : u)));

  const handleSubmit = async () => {
    if (!isConnected || !provider) {
      showToast("error", "Wallet not connected");
      return;
    }
    if (statement.length < 20) {
      showToast("error", "Statement too short", "Minimum 20 characters");
      return;
    }

    const urls = evidenceUrls.filter(Boolean);
    setLoading(true);
    try {
      const hash = await writeContract(provider, "file_appeal", [
        roundId,
        basis,
        statement,
        JSON.stringify(urls),
      ]);
      showToast("info", "Appeal filed", "Waiting for confirmation…");
      await waitForTransaction(hash);
      showToast("success", "Appeal filed successfully");
      onSuccess?.();
    } catch (err) {
      showToast("error", "Appeal failed", extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel p-6 border-award-gold/20">
      <div className="flex items-center gap-3 mb-5">
        <Scale size={18} className="text-award-gold" />
        <h3 className="font-display font-bold text-base text-paper-white">File an Appeal</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label text-xs block mb-2">Appeal Basis</label>
          <select
            value={basis}
            onChange={(e) => setBasis(e.target.value as AppealBasis)}
            className="input-field"
          >
            {APPEAL_BASES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label text-xs block mb-2">Statement</label>
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder="Describe your appeal grounds in detail. Explain what was misread or what new evidence changes the outcome."
            rows={4}
            className="input-field resize-none"
          />
          <p className="text-xs text-slate-grey mt-1">{statement.length} chars (min 20)</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label text-xs">Supporting Evidence URLs</label>
            {evidenceUrls.length < 5 && (
              <button
                onClick={addUrl}
                className="text-xs text-ledger-cyan flex items-center gap-1 hover:text-paper-white"
              >
                <Plus size={12} /> Add URL
              </button>
            )}
          </div>
          {evidenceUrls.map((url, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                type="url"
                value={url}
                onChange={(e) => updateUrl(i, e.target.value)}
                placeholder="https://..."
                className="input-field flex-1"
              />
              {evidenceUrls.length > 1 && (
                <button onClick={() => removeUrl(i)} className="text-slate-grey hover:text-risk-red">
                  <Minus size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <Button onClick={handleSubmit} loading={loading} disabled={!isConnected} className="w-full">
          File Appeal
        </Button>
      </div>
    </div>
  );
}
