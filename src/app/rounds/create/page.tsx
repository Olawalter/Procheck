"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { writeContract, waitForTransaction, readContract } from "@/lib/genlayer";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Plus, Minus, AlertCircle, Info } from "lucide-react";
import { extractError } from "@/lib/utils";

const DEFAULT_WEIGHTS = {
  quality_spec_fit: 40,
  price_reasonableness: 25,
  delivery_reliability: 20,
  compliance_warranty: 15,
};

const DEFAULT_REQS = [
  "Valid company registration",
  "Specification sheet",
  "Delivery within deadline",
  "Maintenance support",
  "At least 2 reference projects",
];

export default function CreateRoundPage() {
  const router = useRouter();
  const { address, provider, isConnected, connect } = useWallet();
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [criteriaText, setCriteriaText] = useState("");
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [requirements, setRequirements] = useState<string[]>(DEFAULT_REQS);
  const [bidDeadlineDays, setBidDeadlineDays] = useState("7");
  const [appealWindowHours, setAppealWindowHours] = useState("48");
  const [escrowGen, setEscrowGen] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const weightsSum = Object.values(weights).reduce((a, b) => a + b, 0);

  const updateWeight = (key: string, val: string) => {
    setWeights((prev) => ({ ...prev, [key]: parseInt(val) || 0 }));
  };

  const addWeight = () => {
    const key = `criterion_${Object.keys(weights).length + 1}`;
    setWeights((prev) => ({ ...prev, [key]: 0 }));
  };

  const removeWeight = (key: string) => {
    setWeights((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addRequirement = () => setRequirements((prev) => [...prev, ""]);
  const removeRequirement = (i: number) => setRequirements((prev) => prev.filter((_, idx) => idx !== i));
  const updateRequirement = (i: number, val: string) =>
    setRequirements((prev) => prev.map((r, idx) => (idx === i ? val : r)));

  const validate = (): string | null => {
    if (title.length < 6) return "Title must be at least 6 characters";
    if (category.length < 3) return "Category must be at least 3 characters";
    if (description.length < 30) return "Description must be at least 30 characters";
    if (criteriaText.length < 30) return "Criteria text must be at least 30 characters";
    if (!budgetMin || !budgetMax) return "Budget range is required";
    if (parseInt(budgetMax) < parseInt(budgetMin)) return "Budget max must be >= budget min";
    if (weightsSum !== 100) return `Criteria weights must sum to 100 (currently ${weightsSum})`;
    const validReqs = requirements.filter(Boolean);
    if (validReqs.length === 0) return "At least one mandatory requirement is required";
    if (parseInt(bidDeadlineDays) < 1) return "Bid deadline must be at least 1 day";
    return null;
  };

  const handleCreate = async () => {
    if (!isConnected || !provider) {
      showToast("error", "Please connect your wallet first");
      return;
    }

    const err = validate();
    if (err) {
      showToast("error", "Validation failed", err);
      return;
    }

    const bidDeadlineTs = Math.floor(Date.now() / 1000) + parseInt(bidDeadlineDays) * 86400;
    const appealWindowSec = parseInt(appealWindowHours) * 3600;
    const validReqs = requirements.filter(Boolean);
    const escrowWei = escrowGen && parseInt(escrowGen) > 0
      ? BigInt(escrowGen) * BigInt("1000000000000000000")
      : BigInt(0);

    setLoading(true);
    try {
      const hash = await writeContract(provider, "create_round", [
        title,
        category,
        description,
        quantity,
        parseInt(budgetMin),
        parseInt(budgetMax),
        criteriaText,
        JSON.stringify(weights),
        JSON.stringify(validReqs),
        bidDeadlineTs,
        appealWindowSec,
      ], escrowWei);
      setTxHash(hash);
      showToast("info", "Transaction submitted", "Waiting for confirmation…");
      await waitForTransaction(hash);

      await new Promise((r) => setTimeout(r, 1500));

      const statsRaw = await readContract<string>("get_contract_stats", []);
      const stats = typeof statsRaw === "string" ? JSON.parse(statsRaw) : statsRaw;
      const newRoundId = Number(stats.total_rounds);
      showToast("success", "Round created!", "Redirecting to your round…");
      router.push(`/rounds/${newRoundId}`);
    } catch (err) {
      showToast("error", "Failed to create round", extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-paper-white">Create Procurement Round</h1>
        <p className="text-sm text-slate-grey mt-1">
          Define your procurement criteria. GenLayer validators will use these to evaluate bids.
        </p>
      </div>

      {!isConnected && (
        <div className="panel border-award-gold/30 p-4 mb-6 flex items-center gap-3">
          <AlertCircle size={16} className="text-award-gold shrink-0" />
          <p className="text-sm text-paper-white">
            You need to connect your wallet to create a round.{" "}
            <button onClick={connect} className="text-ledger-cyan underline">
              Connect now
            </button>
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Basic Info */}
        <div className="panel p-6">
          <h2 className="font-display font-semibold text-base text-paper-white mb-4">
            Basic Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label text-xs block mb-2">Round Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ambulance Fleet Procurement"
                className="input-field"
                maxLength={100}
              />
              <p className="text-xs text-slate-grey mt-1">{title.length}/100</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-xs block mb-2">Category *</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Medical Transport"
                  className="input-field"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="label text-xs block mb-2">Quantity / Scope</label>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 3 ambulances"
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="label text-xs block mb-2">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you need to procure in detail…"
                rows={4}
                className="input-field resize-none"
                maxLength={2000}
              />
              <p className="text-xs text-slate-grey mt-1">{description.length}/2000</p>
            </div>
          </div>
        </div>

        {/* Budget */}
        <div className="panel p-6">
          <h2 className="font-display font-semibold text-base text-paper-white mb-4">
            Budget Range
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label text-xs block mb-2">Minimum (GEN equivalent) *</label>
              <input
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="90000"
                className="input-field"
                min={1}
              />
            </div>
            <div>
              <label className="label text-xs block mb-2">Maximum (GEN equivalent) *</label>
              <input
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="130000"
                className="input-field"
                min={1}
              />
            </div>
          </div>
        </div>

        {/* Criteria */}
        <div className="panel p-6">
          <h2 className="font-display font-semibold text-base text-paper-white mb-4">
            Evaluation Criteria
          </h2>
          <div className="mb-4">
            <label className="label text-xs block mb-2">Criteria Description *</label>
            <textarea
              value={criteriaText}
              onChange={(e) => setCriteriaText(e.target.value)}
              placeholder="Describe your evaluation criteria in detail — what matters most, any scoring guidance…"
              rows={3}
              className="input-field resize-none"
              maxLength={2000}
            />
          </div>

          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="label text-xs">Criteria Weights *</label>
              <p className={`text-xs mt-0.5 ${weightsSum === 100 ? "text-compliance-green" : "text-risk-red"}`}>
                Sum: {weightsSum}/100
              </p>
            </div>
            {Object.keys(weights).length < 6 && (
              <button
                onClick={addWeight}
                className="text-xs text-ledger-cyan flex items-center gap-1 hover:text-paper-white"
              >
                <Plus size={12} /> Add Criterion
              </button>
            )}
          </div>
          <div className="space-y-2">
            {Object.entries(weights).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  type="text"
                  value={key}
                  onChange={(e) => {
                    const newWeights = { ...weights };
                    const oldVal = newWeights[key];
                    delete newWeights[key];
                    newWeights[e.target.value] = oldVal;
                    setWeights(newWeights);
                  }}
                  className="input-field flex-1 text-xs"
                  placeholder="criterion name"
                />
                <input
                  type="number"
                  value={val}
                  onChange={(e) => updateWeight(key, e.target.value)}
                  className="input-field w-20 text-xs"
                  min={0}
                  max={100}
                />
                <span className="text-slate-grey text-xs font-mono">%</span>
                <button onClick={() => removeWeight(key)} className="text-slate-grey hover:text-risk-red">
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Mandatory Requirements */}
        <div className="panel p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold text-base text-paper-white">
                Mandatory Requirements
              </h2>
              <p className="text-xs text-slate-grey mt-0.5">
                Bids must satisfy all of these to qualify.
              </p>
            </div>
            {requirements.length < 12 && (
              <button
                onClick={addRequirement}
                className="text-xs text-ledger-cyan flex items-center gap-1 hover:text-paper-white"
              >
                <Plus size={12} /> Add
              </button>
            )}
          </div>
          <div className="space-y-2">
            {requirements.map((req, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-grey w-4 shrink-0">{i + 1}.</span>
                <input
                  type="text"
                  value={req}
                  onChange={(e) => updateRequirement(i, e.target.value)}
                  placeholder="Requirement…"
                  className="input-field flex-1 text-xs"
                />
                {requirements.length > 1 && (
                  <button onClick={() => removeRequirement(i)} className="text-slate-grey hover:text-risk-red">
                    <Minus size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="panel p-6">
          <h2 className="font-display font-semibold text-base text-paper-white mb-4">Timeline</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label text-xs block mb-2">Bid Deadline (days from now) *</label>
              <input
                type="number"
                value={bidDeadlineDays}
                onChange={(e) => setBidDeadlineDays(e.target.value)}
                className="input-field"
                min={1}
                max={365}
              />
            </div>
            <div>
              <label className="label text-xs block mb-2">Appeal Window (hours after evaluation)</label>
              <input
                type="number"
                value={appealWindowHours}
                onChange={(e) => setAppealWindowHours(e.target.value)}
                className="input-field"
                min={1}
                max={720}
              />
            </div>
          </div>
        </div>

        {/* Escrow */}
        <div className="panel p-6">
          <h2 className="font-display font-semibold text-base text-paper-white mb-1">
            GEN Escrow (Optional)
          </h2>
          <p className="text-xs text-slate-grey mb-4">
            Lock GEN onchain with this round. The escrowed amount is automatically transferred to
            the winning supplier when you finalize, or refunded to you if no valid bid is found.
          </p>
          <div>
            <label className="label text-xs block mb-2">Deposit Amount (whole GEN)</label>
            <input
              type="number"
              value={escrowGen}
              onChange={(e) => setEscrowGen(e.target.value)}
              placeholder="0"
              className="input-field"
              min={0}
            />
            <p className="text-xs text-slate-grey mt-1">
              Leave blank to skip escrow. You can deposit more from the round detail page.
            </p>
          </div>
        </div>

        <div className="panel p-4 border-procurement-blue/30 flex items-start gap-3">
          <Info size={14} className="text-ledger-cyan shrink-0 mt-0.5" />
          <p className="text-xs text-slate-grey">
            After creation, you&apos;ll need to open the round for bids from the round detail page.
            The contract is deployed on GenLayer StudioNet (chain ID 61999).
          </p>
        </div>

        {txHash && (
          <div className="panel p-4 border-award-gold/30">
            <p className="text-xs text-slate-grey mb-1">Transaction Hash</p>
            <a
              href={`${process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-ledger-cyan hover:text-paper-white"
            >
              {txHash}
            </a>
          </div>
        )}

        <Button
          onClick={handleCreate}
          loading={loading}
          disabled={!isConnected || weightsSum !== 100}
          size="lg"
          className="w-full"
        >
          Create Procurement Round
        </Button>
      </div>
    </div>
  );
}
