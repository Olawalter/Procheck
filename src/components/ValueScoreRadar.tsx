"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { EvaluationResult } from "@/types";

interface ValueScoreRadarProps {
  evaluation: EvaluationResult;
}

const BAND_SCORES: Record<string, number> = {
  // quality
  poor: 10, weak: 30, acceptable: 50, strong: 75, excellent: 95,
  // price
  overpriced: 10, questionable: 30, fair: 60, good_value: 80, exceptional_value: 95,
  // compliance
  non_compliant: 5, partial: 40, complete: 90,
  // risk (inverted: lower risk = higher score)
  high: 10, medium: 40, low: 75, minimal: 95,
};

export function ValueScoreRadar({ evaluation }: ValueScoreRadarProps) {
  const data = [
    { subject: "Quality", value: BAND_SCORES[evaluation.quality_band] ?? 50 },
    { subject: "Price Value", value: BAND_SCORES[evaluation.price_value_band] ?? 50 },
    { subject: "Compliance", value: BAND_SCORES[evaluation.compliance_band] ?? 50 },
    { subject: "Risk (inv)", value: BAND_SCORES[evaluation.risk_band] ?? 50 },
    { subject: "Confidence", value: evaluation.confidence },
  ];

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="rgba(29,78,216,0.3)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#8B93A1", fontSize: 10, fontFamily: "IBM Plex Mono" }}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="#22D3EE"
            fill="#22D3EE"
            fillOpacity={0.15}
            strokeWidth={1.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
