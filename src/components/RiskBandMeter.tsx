import type { RiskBand } from "@/types";
import { getBandLabel } from "@/lib/utils";

interface RiskBandMeterProps {
  band: RiskBand;
  label?: string;
}

const RISK_LEVELS: RiskBand[] = ["high", "medium", "low", "minimal"];

const BAND_COLORS: Record<RiskBand, string> = {
  high: "#FF4D5E",
  medium: "#F5B841",
  low: "#2CE88A",
  minimal: "#22D3EE",
};

export function RiskBandMeter({ band, label = "Risk Level" }: RiskBandMeterProps) {
  const index = RISK_LEVELS.indexOf(band);
  const color = BAND_COLORS[band];
  const fillPct = ((4 - index) / 4) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="label text-xs">{label}</span>
        <span className="font-mono text-xs font-semibold" style={{ color }}>
          {getBandLabel(band)}
        </span>
      </div>
      <div className="h-2 bg-deep-steel rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${fillPct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="font-mono text-[10px] text-risk-red">High</span>
        <span className="font-mono text-[10px] text-ledger-cyan">Minimal</span>
      </div>
    </div>
  );
}
