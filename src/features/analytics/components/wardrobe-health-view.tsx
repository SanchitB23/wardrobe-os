"use client";

import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
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
import { useWardrobeHealth } from "@/features/analytics/hooks";
import { cn } from "@/lib/utils";
import type {
  CategoryBucket,
  CoverageContext,
  WardrobeHealth,
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

const COVERAGE_LABELS: Record<CoverageContext, string> = {
  office: "Office",
  travel: "Travel",
  wedding: "Wedding",
  gym: "Gym",
  vacation: "Vacation",
  winter: "Winter",
  summer: "Summer",
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
            <CardTitle>Occasion & season coverage</CardTitle>
            <CardDescription>
              How ready your wardrobe is for each context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(COVERAGE_LABELS) as CoverageContext[]).map((context) => (
              <ScoreBar
                key={context}
                label={COVERAGE_LABELS[context]}
                score={health.coverage[context]}
              />
            ))}
          </CardContent>
        </Card>
      </div>

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
              Colors or categories you may be over-buying.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {health.duplicates.length > 0 ? (
              <ul className="space-y-2">
                {health.duplicates.map((duplicate, index) => (
                  <li
                    key={`${index}-${duplicate.label}`}
                    className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <span>{duplicate.label}</span>
                    <Badge variant="outline" className="capitalize">
                      {duplicate.type}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No significant duplicates detected.
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
              Categories below their recommended count.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {health.gaps.length > 0 ? (
              <ul className="space-y-2">
                {health.gaps.map((gap) => (
                  <li
                    key={gap.category}
                    className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <span>{CATEGORY_LABELS[gap.category]}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {gap.current} / {gap.recommended}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Every category meets its recommended count.
              </p>
            )}
          </CardContent>
        </Card>
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
  const health = healthQuery.data;

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
    </div>
  );
}
