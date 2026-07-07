"use client";

import type { BuyVsSkipBreakdown, DimensionKey } from "@/features/acquisition/types";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const DIMENSIONS: { key: DimensionKey; label: string; inverse?: boolean }[] = [
  { key: "gapFillValue", label: "Gap fill value" },
  { key: "outfitCompatibility", label: "Outfit compatibility" },
  { key: "usageProjection", label: "Usage projection" },
  { key: "duplicateRisk", label: "Duplicate risk", inverse: true },
  { key: "costEfficiency", label: "Cost efficiency" },
  { key: "wardrobeHealthImpact", label: "Wardrobe health impact" },
  { key: "practicality", label: "Practicality" },
  { key: "preferenceFit", label: "Preference fit" },
];

export function ScoreBreakdown({ breakdown }: { breakdown: BuyVsSkipBreakdown }) {
  return (
    <div className="space-y-3">
      {DIMENSIONS.map(({ key, label, inverse }) => {
        const dim = breakdown[key];
        // For the inverse dimension, a high raw score is bad — colour it red.
        const good = inverse ? dim.score <= 4 : dim.score >= 7;
        const bad = inverse ? dim.score >= 8 : dim.score < 4;
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                {label}
                {inverse ? (
                  <span className="text-[10px] uppercase text-muted-foreground/70">(lower is better)</span>
                ) : null}
              </span>
              <span
                className={cn(
                  "tabular-nums font-medium",
                  good && "text-emerald-600 dark:text-emerald-400",
                  bad && "text-destructive",
                )}
              >
                {dim.score.toFixed(1)}/10
              </span>
            </div>
            <Progress value={dim.score * 10} />
            <p className="text-xs text-muted-foreground">{dim.reason}</p>
          </div>
        );
      })}
    </div>
  );
}
