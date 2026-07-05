"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BugIcon,
  CheckCircleIcon,
  CopyIcon,
  LayersIcon,
  LightbulbIcon,
} from "lucide-react";

import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWardrobeHealth } from "@/features/analytics/hooks";
import { cn } from "@/lib/utils";
import type {
  CategoryBucket,
  DebugDistribution,
  GapPriority,
  OccasionContext,
  ScoreBreakdown,
  SeasonContext,
  WardrobeHealth,
  WardrobeHealthDebug,
} from "@/domain/analytics/WardrobeHealthEngine";

type ScoreTone = {
  label: string;
  text: string;
  bar: string;
};

function scoreTone(score: number): ScoreTone {
  if (score >= 90) {
    return {
      label: "Excellent",
      text: "text-emerald-600 dark:text-emerald-400",
      bar: "[&_[data-slot=progress-indicator]]:bg-emerald-500",
    };
  }
  if (score >= 75) {
    return {
      label: "Good",
      text: "text-blue-600 dark:text-blue-400",
      bar: "[&_[data-slot=progress-indicator]]:bg-blue-500",
    };
  }
  if (score >= 60) {
    return {
      label: "Needs attention",
      text: "text-amber-600 dark:text-amber-400",
      bar: "[&_[data-slot=progress-indicator]]:bg-amber-500",
    };
  }
  return {
    label: "Weak",
    text: "text-destructive",
    bar: "[&_[data-slot=progress-indicator]]:bg-destructive",
  };
}

const CATEGORY_LABELS: Record<CategoryBucket, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  footwear: "Footwear",
  outerwear: "Outerwear",
  accessories: "Accessories",
  fragrance: "Fragrance",
};

const OCCASION_LABELS: Record<OccasionContext, string> = {
  officeDaily: "Office daily",
  smartCasual: "Smart casual",
  travel: "Travel",
  social: "Dinner / date / brewery",
  formal: "Wedding / formal",
  gym: "Gym",
  home: "Home / everyday",
};

const SEASON_LABELS: Record<SeasonContext, string> = {
  summer: "Summer",
  transitional: "Spring / autumn / monsoon",
  winter: "Winter",
};

const GAP_PRIORITY_TONE: Record<GapPriority, string> = {
  high: "text-destructive",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-muted-foreground",
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const tone = scoreTone(score);
  return (
    <Progress
      value={score}
      max={100}
      aria-label={`${label} score`}
      className={cn("flex-col items-stretch gap-1.5", tone.bar)}
    >
      <div className="flex items-center justify-between">
        <ProgressLabel className="text-sm">{label}</ProgressLabel>
        <ProgressValue className={cn("text-sm font-medium", tone.text)}>
          {() => `${score}`}
        </ProgressValue>
      </div>
    </Progress>
  );
}

function NarrativeCard({
  title,
  description,
  icon: Icon,
  items,
  empty,
  tone,
}: {
  title: string;
  description: string;
  icon: typeof CheckCircleIcon;
  items: string[];
  empty: string;
  tone: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("size-4", tone)} />
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="secondary" className="ml-auto tabular-nums">
            {items.length}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {items.map((entry, index) => (
              <li key={`${index}-${entry}`} className="flex gap-2">
                <Icon className={cn("mt-0.5 size-3.5 shrink-0", tone)} />
                <span>{entry}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function HealthReport({ health }: { health: WardrobeHealth }) {
  const overall = scoreTone(health.overallScore);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Overall wardrobe health
            </p>
            <div className="flex items-baseline gap-3">
              <span className={cn("text-5xl font-semibold tabular-nums", overall.text)}>
                {health.overallScore}
              </span>
              <span className="text-lg text-muted-foreground">/100</span>
              <Badge variant="secondary" className={overall.text}>
                {overall.label}
              </Badge>
            </div>
          </div>
          <div className="w-full sm:max-w-xs">
            <Progress
              value={health.overallScore}
              max={100}
              aria-label="Overall health score"
              className={overall.bar}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category balance</CardTitle>
            <CardDescription>
              Coverage of each wardrobe category against recommended minimums.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(CATEGORY_LABELS) as CategoryBucket[]).map((bucket) => (
              <ScoreBar
                key={bucket}
                label={CATEGORY_LABELS[bucket]}
                score={health.categoryScores[bucket]}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Occasion coverage</CardTitle>
            <CardDescription>
              Readiness for each occasion, weighted by how much it matters to a
              WFH + occasional-office lifestyle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(OCCASION_LABELS) as OccasionContext[]).map((context) => (
              <ScoreBar
                key={context}
                label={OCCASION_LABELS[context]}
                score={health.occasions[context]}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Season coverage</CardTitle>
          <CardDescription>
            Weighted for Delhi NCR — summer and year-round dominate; a light
            winter wardrobe is expected, not penalized.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {(Object.keys(SEASON_LABELS) as SeasonContext[]).map((context) => (
            <ScoreBar
              key={context}
              label={SEASON_LABELS[context]}
              score={health.seasons[context]}
            />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <NarrativeCard
          title="Strengths"
          description="What your wardrobe does well."
          icon={CheckCircleIcon}
          items={health.strengths}
          empty="No standout strengths yet."
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <NarrativeCard
          title="Weaknesses"
          description="Where your wardrobe falls short."
          icon={AlertTriangleIcon}
          items={health.weaknesses}
          empty="No notable weaknesses."
          tone="text-amber-600 dark:text-amber-400"
        />
        <NarrativeCard
          title="Recommendations"
          description="Suggested next additions."
          icon={LightbulbIcon}
          items={health.recommendations}
          empty="Nothing to recommend right now."
          tone="text-blue-600 dark:text-blue-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CopyIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Duplicate analysis</CardTitle>
            </div>
            <CardDescription>
              Clusters of same colour + formality where several pieces are rarely
              worn. Deep, well-used categories are fine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {health.duplicates.length > 0 ? (
              <ul className="space-y-2">
                {health.duplicates.map((duplicate, index) => (
                  <li
                    key={`${index}-${duplicate.label}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <span className="capitalize">
                      {duplicate.label}
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {duplicate.lowValueCount} low-use
                      </span>
                    </span>
                    <Badge
                      variant={duplicate.severity === "excess" ? "destructive" : "secondary"}
                      className="shrink-0 capitalize"
                    >
                      {duplicate.severity === "excess" ? "Excess" : "Watch list"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No problematic duplicate clusters detected.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <LayersIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Gap analysis</CardTitle>
            </div>
            <CardDescription>
              Practical smart-casual staples worth adding next.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {health.gaps.length > 0 ? (
              <ul className="space-y-2">
                {health.gaps.map((gap) => (
                  <li
                    key={`${gap.kind}-${gap.label}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <span>
                      {gap.label}
                      <span className="ml-1 block text-xs text-muted-foreground">
                        {gap.detail}
                      </span>
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("shrink-0 capitalize", GAP_PRIORITY_TONE[gap.priority])}
                    >
                      {gap.priority}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No priority gaps — the smart-casual rotation is well stocked.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DistributionCard({ dist }: { dist: DebugDistribution }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{dist.label}</CardTitle>
          <Badge variant="secondary" className="ml-auto tabular-nums">
            {dist.distinct} distinct
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {dist.buckets.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {dist.buckets.map((bucket) => (
              <li
                key={bucket.label}
                className="flex items-center justify-between gap-3"
              >
                <span
                  className={cn(
                    "truncate",
                    bucket.label.startsWith("—") && "text-muted-foreground italic",
                  )}
                >
                  {bucket.label}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {bucket.count}
                  <span className="ml-1 text-xs">({bucket.percentage}%)</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No items.</p>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownTable({
  caption,
  rows,
}: {
  caption: string;
  rows: ScoreBreakdown[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{caption}</CardTitle>
        <CardDescription>
          Raw inputs, the formula applied, and the resulting components for every
          score.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Score</TableHead>
              <TableHead>Inputs</TableHead>
              <TableHead>Formula</TableHead>
              <TableHead>Components</TableHead>
              <TableHead className="text-right">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const tone = scoreTone(row.score);
              return (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <ul className="space-y-0.5">
                      {row.inputs.map((input, index) => (
                        <li key={index}>
                          {input.label}:{" "}
                          <span className="tabular-nums text-foreground">
                            {input.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.formula}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <ul className="space-y-0.5">
                      {row.components.map((component, index) => (
                        <li key={index}>
                          {component.label}:{" "}
                          <span className="tabular-nums text-foreground">
                            {component.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell
                    className={cn("text-right tabular-nums font-semibold", tone.text)}
                  >
                    {row.score}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function HealthDebugPanel({ debug }: { debug: WardrobeHealthDebug }) {
  return (
    <div className="space-y-6 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <BugIcon className="size-4 text-amber-600 dark:text-amber-400" />
        <h2 className="text-lg font-semibold">Debug mode</h2>
        <Badge variant="secondary" className="tabular-nums">
          {debug.totalActiveItems} active
        </Badge>
        {debug.totalItems !== debug.totalActiveItems ? (
          <Badge variant="outline" className="tabular-nums text-muted-foreground">
            {debug.totalItems} fetched
          </Badge>
        ) : null}
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        Every number the health report is built from. All values are computed in
        the domain engine; nothing here is derived in the component.
      </p>

      {debug.warnings.length > 0 ? (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon className="size-4 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-base">Data-quality warnings</CardTitle>
              <Badge variant="secondary" className="ml-auto tabular-nums">
                {debug.warnings.reduce((sum, w) => sum + w.count, 0)}
              </Badge>
            </div>
            <CardDescription>
              Items with missing or generic metadata that can skew the report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {debug.warnings.map((warning) => (
              <div key={warning.key}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{warning.label}</span>
                  <Badge variant="outline" className="tabular-nums">
                    {warning.count}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {warning.items
                    .slice(0, 12)
                    .map((item) => item.name)
                    .join(", ")}
                  {warning.items.length > 12
                    ? `, +${warning.items.length - 12} more`
                    : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-emerald-500/40">
          <CardContent className="flex items-center gap-2 pt-6 text-sm">
            <CheckCircleIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
            No data-quality warnings — every active item has complete metadata.
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          Distributions
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {debug.distributions.map((dist) => (
            <DistributionCard key={dist.key} dist={dist} />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <BreakdownTable
          caption="Category score derivations"
          rows={debug.categoryScores}
        />
        <BreakdownTable
          caption="Occasion score derivations"
          rows={debug.occasionScores}
        />
        <BreakdownTable
          caption="Season score derivations"
          rows={debug.seasonScores}
        />
        <BreakdownTable caption="Overall score derivation" rows={[debug.overall]} />
      </div>
    </div>
  );
}

function HealthSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function WardrobeHealthView() {
  const healthQuery = useWardrobeHealth();
  const [showDebug, setShowDebug] = useState(false);
  const report = healthQuery.data;
  const health = report?.health;
  const debug = report?.debug;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Wardrobe Health"
        badge={
          health ? (
            <Badge variant="secondary" className="tabular-nums">
              {health.overallScore}/100
            </Badge>
          ) : null
        }
        description="A deterministic health report across category balance, coverage, duplicates, and gaps."
        breadcrumb={
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            render={<Link href="/dashboard" />}
          >
            <ArrowLeftIcon />
            Dashboard
          </Button>
        }
        actions={
          <Button
            variant={showDebug ? "default" : "outline"}
            onClick={() => setShowDebug((value) => !value)}
            aria-pressed={showDebug}
          >
            <BugIcon />
            Debug
          </Button>
        }
      />

      {healthQuery.isPending ? <HealthSkeleton /> : null}

      {healthQuery.error ? (
        <InventoryErrorState
          message={healthQuery.error.message}
          onRetry={() => void healthQuery.refetch()}
          isRetrying={healthQuery.isFetching}
        />
      ) : null}

      {health ? <HealthReport health={health} /> : null}

      {showDebug && debug ? <HealthDebugPanel debug={debug} /> : null}
    </div>
  );
}
