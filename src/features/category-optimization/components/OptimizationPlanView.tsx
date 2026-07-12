"use client";

import Link from "next/link";

import type { OptimizationPlan } from "@/domain/category-optimization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DECISION_TONE: Record<string, string> = {
  keep: "bg-emerald-600 text-white",
  protect: "bg-amber-500 text-white",
  rotate: "bg-blue-600 text-white",
  retire: "bg-destructive text-white",
  ignore: "bg-muted text-muted-foreground",
};

export function OptimizationPlanView({ plan }: { plan: OptimizationPlan }) {
  const { summary } = plan;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Optimization Plan</CardTitle>
        <CardDescription>
          Deterministic recommendations — nothing is retired or deleted
          automatically. Retire links open inventory for an explicit confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge className={DECISION_TONE.keep}>Keep {summary.keep}</Badge>
          <Badge className={DECISION_TONE.protect}>
            Protect {summary.protect}
          </Badge>
          <Badge className={DECISION_TONE.rotate}>Rotate {summary.rotate}</Badge>
          <Badge className={DECISION_TONE.retire}>Retire {summary.retire}</Badge>
          <Badge className={DECISION_TONE.ignore}>Ignore {summary.ignore}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3 text-sm">
            <div className="text-xs text-muted-foreground">
              Estimated health improvement
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {plan.estimatedHealthImprovement == null
                ? "—"
                : `+${plan.estimatedHealthImprovement}`}
            </div>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <div className="text-xs text-muted-foreground">
              Estimated ROI improvement
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {plan.estimatedRoiImprovement == null
                ? "—"
                : `+${plan.estimatedRoiImprovement}`}
            </div>
          </div>
        </div>

        <ul className="space-y-2">
          {plan.items.map((row) => (
            <li
              key={row.itemId}
              className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={`capitalize ${DECISION_TONE[row.decision] ?? ""}`}
                  >
                    {row.decision}
                  </Badge>
                  <span className="font-medium">{row.label}</span>
                </div>
                <p className="text-muted-foreground">{row.reason}</p>
              </div>
              {row.decision === "retire" ? (
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/inventory/${row.itemId}`} />}
                >
                  Review in inventory
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
