"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { readContract, writeContract, waitForTransaction } from "@/lib/genlayer";
import type { ProcurementRound, Bid } from "@/types";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { ProcurementPacketPreview } from "@/components/ProcurementPacketPreview";
import { ComplianceChecklist } from "@/components/ComplianceChecklist";
import { Plus, Minus, ChevronRight, AlertCircle } from "lucide-react";
import { extractError } from "@/lib/utils";

export default function SubmitBidPage() {
  const params = useParams();
  const router = useRouter();
  const roundId = Number(params.roundId);
  const { address, account, isConnected, connect } = useWallet();
  const { showToast } = useToast();

  const [round, setRound] = useState<ProcurementRound | null>(null);
  const [existingBid, setExistingBid] = useState<Bid | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [price, setPrice] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [technicalSummary, setTechnicalSummary] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [complianceStatement, setComplianceStatement] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(["", ""]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const roundData = await readContract<ProcurementRound>("get_round", [roundId]);
        setRound(roundData);

        if (address) {
          const bids = await readContract<Bid[]>("get_round_bids", [roundId]);
          const mine = bids.find(
            (b) => b.supplier.toLowerCase() === address.toLowerCase()
          );
          if (mine) {
            setExistingBid(mine);
            setPrice(String(mine.price));
            setDeliveryDays(String(mine.delivery_timeline_days));
            setTechnicalSummary(mine.technical_summary);
            setWarrantyTerms(mine.warranty_terms);
            setComplianceStatement(mine.compliance_statement);
            const urls = JSON.parse(mine.evidence_urls || "[]") as string[];
            setEvidenceUrls(urls.length > 0 ? urls : [""]);
          }
        }
      } catch (err) {
        showToast("error", "Failed to load round", extractError(err));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [roundId, address]);

  const addUrl = () => {
    if (evidenceUrls.length < 8) setEvidenceUrls((p) => [...p, ""]);
  };
  const removeUrl = (i: number) => setEvidenceUrls((p) => p.filter((_, idx) => idx !== i));
  const updateUrl = (i: number, v: string) =>
    setEvidenceUrls((p) => p.map((u, idx) => (idx === i ? v : u)));

  const validate = (): string | null => {
    if (!price || parseInt(price) <= 0) return "Price must be a positive number";
    if (!deliveryDays || parseInt(deliveryDays) <= 0) return "Delivery timeline is required";
    if (technicalSummary.length < 50) return "Technical summary must be at least 50 characters";
    if (complianceStatement.length < 30) return "Compliance statement must be at least 30 characters";
    const urls = evidenceUrls.filter(Boolean);
    if (urls.length === 0) return "At least one evidence URL is required";
    for (const url of urls) {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return `Invalid URL: ${url}`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!isConnected || !account) {
      showToast("error", "Please connect your wallet");
      return;
    }
    const err = validate();
    if (err) {
      showToast("error", "Validation error", err);
      return;
    }

    const urls = evidenceUrls.filter(Boolean);
    setSubmitting(true);
    try {
      let hash: string;
      if (existingBid) {
        hash = await writeContract(account.privateKey, "revise_bid", [
          existingBid.bid_id,
          parseInt(price),
          parseInt(deliveryDays),
          technicalSummary,
          warrantyTerms,
          complianceStatement,
          JSON.stringify(urls),
        ]);
      } else {
        hash = await writeContract(account.privateKey, "submit_bid", [
          roundId,
          parseInt(price),
          parseInt(deliveryDays),
          technicalSummary,
          warrantyTerms,
          complianceStatement,
          JSON.stringify(urls),
        ]);
      }

      setTxHash(hash);
      showToast("info", existingBid ? "Bid revision submitted" : "Bid submitted", "Waiting for confirmation…");
      await waitForTransaction(account.privateKey, hash as `0x${string}`);
      showToast("success", existingBid ? "Bid revised successfully!" : "Bid submitted successfully!");
      router.push(`/rounds/${roundId}`);
    } catch (err) {
      showToast("error", "Submission failed", extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="panel h-64 animate-pulse" />
      </div>
    );
  }

  if (!round || round.status !== "open_for_bids") {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="panel border-risk-red/30 p-6 flex items-start gap-3">
          <AlertCircle size={18} className="text-risk-red shrink-0" />
          <div>
            <p className="font-display font-semibold text-risk-red">Bids not accepted</p>
            <p className="text-xs text-slate-grey mt-1">
              This round is not currently open for bids. Status: {round?.status ?? "unknown"}
            </p>
            <Link href={`/rounds/${roundId}`} className="text-xs text-ledger-cyan mt-2 inline-block">
              ← Back to Round
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-2 text-xs text-slate-grey mb-6">
        <Link href="/rounds" className="hover:text-ledger-cyan">Bid Board</Link>
        <ChevronRight size={12} />
        <Link href={`/rounds/${roundId}`} className="hover:text-ledger-cyan">Round #{roundId}</Link>
        <ChevronRight size={12} />
        <span className="text-paper-white">{existingBid ? "Revise Bid" : "Submit Bid"}</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Round preview */}
        <div>
          <h2 className="font-display font-semibold text-sm text-slate-grey uppercase tracking-wider mb-3">
            Procurement Brief
          </h2>
          <ProcurementPacketPreview round={round} />

          <div className="panel p-5 mt-4">
            <h3 className="font-display font-semibold text-sm text-paper-white mb-3">
              Mandatory Requirements
            </h3>
            <ComplianceChecklist requirementsJson={round.mandatory_requirements} />
          </div>
        </div>

        {/* Bid form */}
        <div>
          <h2 className="font-display font-semibold text-sm text-slate-grey uppercase tracking-wider mb-3">
            {existingBid ? "Revise Your Bid" : "Your Bid Packet"}
          </h2>

          {!isConnected && (
            <div className="panel border-award-gold/30 p-4 mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-paper-white">Connect wallet to submit</p>
              <Button size="sm" onClick={connect}>Connect</Button>
            </div>
          )}

          <div className="space-y-4">
            <div className="panel p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs block mb-2">Price (GEN equivalent) *</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="112000"
                    className="input-field"
                    min={1}
                  />
                </div>
                <div>
                  <label className="label text-xs block mb-2">Delivery Timeline (days) *</label>
                  <input
                    type="number"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(e.target.value)}
                    placeholder="45"
                    className="input-field"
                    min={1}
                  />
                </div>
              </div>
            </div>

            <div className="panel p-5 space-y-4">
              <div>
                <label className="label text-xs block mb-2">Technical Summary *</label>
                <textarea
                  value={technicalSummary}
                  onChange={(e) => setTechnicalSummary(e.target.value)}
                  placeholder="Describe exactly what you will deliver — specifications, features, materials, capabilities…"
                  rows={5}
                  className="input-field resize-none"
                  maxLength={3000}
                />
                <p className="text-xs text-slate-grey mt-1">
                  {technicalSummary.length}/3000 (min 50)
                </p>
              </div>

              <div>
                <label className="label text-xs block mb-2">Warranty / Support Terms *</label>
                <textarea
                  value={warrantyTerms}
                  onChange={(e) => setWarrantyTerms(e.target.value)}
                  placeholder="Describe warranty period, what's covered, support response times…"
                  rows={3}
                  className="input-field resize-none"
                />
              </div>

              <div>
                <label className="label text-xs block mb-2">Compliance Statement *</label>
                <textarea
                  value={complianceStatement}
                  onChange={(e) => setComplianceStatement(e.target.value)}
                  placeholder="State how you meet each mandatory requirement. Include certifications, registration details, references…"
                  rows={3}
                  className="input-field resize-none"
                  maxLength={2000}
                />
                <p className="text-xs text-slate-grey mt-1">{complianceStatement.length}/2000 (min 30)</p>
              </div>
            </div>

            <div className="panel p-5">
              <div className="flex items-center justify-between mb-3">
                <label className="label text-xs">Evidence URLs * (1–8)</label>
                {evidenceUrls.length < 8 && (
                  <button
                    onClick={addUrl}
                    className="text-xs text-ledger-cyan flex items-center gap-1 hover:text-paper-white"
                  >
                    <Plus size={12} /> Add URL
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {evidenceUrls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => updateUrl(i, e.target.value)}
                      placeholder="https://example.com/spec-sheet.pdf"
                      className="input-field flex-1 text-xs"
                    />
                    {evidenceUrls.length > 1 && (
                      <button
                        onClick={() => removeUrl(i)}
                        className="text-slate-grey hover:text-risk-red"
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-grey mt-2">
                Link to spec sheets, company registration, reference projects, certifications.
              </p>
            </div>

            {txHash && (
              <div className="panel p-3 border-award-gold/30">
                <p className="text-xs text-slate-grey mb-1">Transaction</p>
                <a
                  href={`${process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-ledger-cyan hover:text-paper-white break-all"
                >
                  {txHash}
                </a>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={!isConnected}
              size="lg"
              className="w-full"
              variant={existingBid ? "secondary" : "primary"}
            >
              {existingBid ? "Revise Bid" : "Submit Bid Packet"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
