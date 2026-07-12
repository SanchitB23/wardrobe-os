"use client";

import type { ItemComparison } from "@/domain/category-optimization";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

export function ItemComparisonTable({
  comparisons,
  focusItemId,
}: {
  comparisons: ItemComparison[];
  focusItemId?: string | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Item Comparison</CardTitle>
        <CardDescription>
          Ranked by composite keep-value. Missing signals show as —.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {comparisons.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No items matched this category.
          </p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Item</th>
                <th className="py-2 pr-2 font-medium">Wears</th>
                <th className="py-2 pr-2 font-medium">CPW</th>
                <th className="py-2 pr-2 font-medium">ROI</th>
                <th className="py-2 pr-2 font-medium">Outfits</th>
                <th className="py-2 pr-2 font-medium">Recs</th>
                <th className="py-2 pr-2 font-medium">StyleDNA</th>
                <th className="py-2 pr-2 font-medium">Visual</th>
                <th className="py-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((row) => {
                const focused = focusItemId === row.itemId;
                return (
                  <tr
                    key={row.itemId}
                    className={cn(
                      "border-b border-border/60",
                      focused && "bg-amber-500/10",
                    )}
                  >
                    <td className="py-2 pr-2">
                      <div className="font-medium">{row.label}</div>
                      {focused ? (
                        <Badge variant="outline" className="mt-0.5 text-[10px]">
                          Focus
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{row.wearCount}</td>
                    <td className="py-2 pr-2 tabular-nums">
                      {fmt(row.costPerWear)}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{fmt(row.roi, 0)}</td>
                    <td className="py-2 pr-2 tabular-nums">
                      {row.outfitCoverage == null
                        ? "—"
                        : `${Math.round(row.outfitCoverage * 100)}%`}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">
                      {fmt(row.recommendationFrequency, 0)}
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex max-w-[160px] flex-wrap gap-1">
                        {row.styleDnaSummary.slice(0, 3).map((s) => (
                          <Badge
                            key={s}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                      {row.visualSimilarityPeers.length === 0
                        ? "—"
                        : row.visualSimilarityPeers.length}
                    </td>
                    <td className="py-2 tabular-nums font-medium">
                      {row.compositeValue.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
