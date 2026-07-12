"use client";

import type { CategoryAnalysis } from "@/domain/category-optimization";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function scoreOrDash(n: number | null): string {
  return n == null ? "—" : String(n);
}

export function CategoryAnalysisPanel({
  analysis,
}: {
  analysis: CategoryAnalysis;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Category Analysis</CardTitle>
        <CardDescription>
          {analysis.label} · confidence {Math.round(analysis.confidence * 100)}%
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Current count" value={analysis.currentCount} />
          <Metric label="Ideal count" value={analysis.idealCount} />
          <Metric label="Category score" value={analysis.categoryScore} />
          <Metric label="Health" value={scoreOrDash(analysis.healthScore)} />
          <Metric label="ROI" value={scoreOrDash(analysis.roiScore)} />
          <Metric
            label="Coverage"
            value={scoreOrDash(analysis.coverageScore)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Category score</span>
            <span className="tabular-nums font-medium">
              {analysis.categoryScore}/100
            </span>
          </div>
          <Progress value={analysis.categoryScore} className="h-1.5" />
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Usage distribution
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis.usageDistribution.length === 0 ? (
              <span className="text-sm text-muted-foreground">No usage data.</span>
            ) : (
              analysis.usageDistribution.map((u) => (
                <Badge key={u.bucket} variant="outline" className="capitalize">
                  {u.bucket}: {u.count}
                </Badge>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reason codes
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.reasonCodes.map((code) => (
              <Badge key={code} variant="secondary" className="font-mono text-[10px]">
                {code}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
