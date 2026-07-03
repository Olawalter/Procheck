import { parseCriteriaWeights } from "@/lib/utils";

interface CriteriaWeightGridProps {
  weightsJson: string;
}

export function CriteriaWeightGrid({ weightsJson }: CriteriaWeightGridProps) {
  const weights = parseCriteriaWeights(weightsJson);
  const entries = Object.entries(weights);

  return (
    <div className="grid grid-cols-2 gap-2">
      {entries.map(([key, value]) => {
        const pct = Number(value);
        return (
          <div key={key} className="bg-deep-steel rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="label text-xs capitalize">
                {key.replace(/_/g, " ")}
              </span>
              <span className="font-mono text-xs text-ledger-cyan font-semibold">{pct}%</span>
            </div>
            <div className="h-1.5 bg-midnight-navy rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-procurement-blue to-ledger-cyan"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
