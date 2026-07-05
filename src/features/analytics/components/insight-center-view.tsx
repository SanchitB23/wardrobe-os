"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  LightbulbIcon,
  RefreshCwIcon,
  SparklesIcon,
  TargetIcon,
  TrendingUpIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";

import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { PageHeader } from "@/features/layout";
import { useInsightReport } from "@/features/analytics/hooks";
import { buildInventoryHref } from "@/features/inventory/lib/inventory-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  InsightPriority,
  InsightType,
  WardrobeInsight,
} from "@/domain/analytics/InsightEngine";

const PRIORITY_TONE: Record<InsightPriority, string> = {
  critical:
    "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  low: "bg-muted text-muted-foreground border-transparent",
};

const TYPE_META: Record<
  InsightType,
  { label: string; tone: string; icon: typeof SparklesIcon }
> = {
  strength: {
    label: "Strength",
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    icon: CheckCircleIcon,
  },
  weakness: {
    label: "Weakness",
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: WrenchIcon,
  },
  opportunity: {
    label: "Opportunity",
    tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    icon: TargetIcon,
  },
  warning: {
    label: "Warning",
    tone: "bg-destructive/10 text-destructive border-destructive/30",
    icon: AlertTriangleIcon,
  },
  action: {
    label: "Action",
    tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
    icon: LightbulbIcon,
  },
};

const TYPE_ORDER: InsightType[] = [
  "warning",
  "opportunity",
  "weakness",
  "action",
  "strength",
];
const PRIORITY_ORDER: InsightPriority[] = ["critical", "high", "medium", "low"];

const SECTION_TITLE: Record<InsightType, string> = {
  warning: "Warnings",
  opportunity: "Opportunities",
  weakness: "Weaknesses",
  action: "Actions",
  strength: "Strengths",
};

function InsightCard({ insight }: { insight: WardrobeInsight }) {
  const typeMeta = TYPE_META[insight.type];
  const TypeIcon = typeMeta.icon;
  const relatedCount = insight.relatedItemIds?.length ?? 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("capitalize", PRIORITY_TONE[insight.priority])}>
            {insight.priority}
          </Badge>
          <Badge variant="outline" className={cn("gap-1", typeMeta.tone)}>
            <TypeIcon className="size-3" data-icon="inline-start" />
            {typeMeta.label}
          </Badge>
        </div>
        <CardTitle className="text-base leading-snug">{insight.title}</CardTitle>
        {insight.description && insight.description !== insight.title ? (
          <CardDescription>{insight.description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {insight.evidence.length > 0 ? (
          <ul className="space-y-1 text-muted-foreground">
            {insight.evidence.map((entry, index) => (
              <li key={index} className="flex gap-2">
                <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                <span>{entry}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {insight.suggestedActions.length > 0 ? (
          <ul className="space-y-1">
            {insight.suggestedActions.map((action, index) => (
              <li key={index} className="flex gap-2">
                <LightbulbIcon className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {relatedCount > 0 || insight.relatedCategory ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {insight.relatedCategory ? (
              <Badge variant="secondary" render={<Link href={buildInventoryHref({ category: insight.relatedCategory })} />}>
                {insight.relatedCategory}
              </Badge>
            ) : null}
            {relatedCount > 0 ? (
              <span className="text-xs text-muted-foreground">
                {relatedCount} related {relatedCount === 1 ? "item" : "items"}
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-3 text-xs font-medium capitalize transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function InsightSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function InsightCenterView() {
  const insightQuery = useInsightReport();
  const report = insightQuery.data;

  const [typeFilters, setTypeFilters] = useState<Set<InsightType>>(new Set());
  const [priorityFilters, setPriorityFilters] = useState<Set<InsightPriority>>(
    new Set(),
  );

  function toggleType(type: InsightType) {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }
  function togglePriority(priority: InsightPriority) {
    setPriorityFilters((prev) => {
      const next = new Set(prev);
      if (next.has(priority)) next.delete(priority);
      else next.add(priority);
      return next;
    });
  }
  function clearFilters() {
    setTypeFilters(new Set());
    setPriorityFilters(new Set());
  }

  const filtersActive = typeFilters.size > 0 || priorityFilters.size > 0;

  const filtered = useMemo(() => {
    if (!report) return [];
    return report.insights.filter(
      (insight) =>
        (typeFilters.size === 0 || typeFilters.has(insight.type)) &&
        (priorityFilters.size === 0 || priorityFilters.has(insight.priority)),
    );
  }, [report, typeFilters, priorityFilters]);

  const grouped = useMemo(() => {
    const map = new Map<InsightType, WardrobeInsight[]>();
    for (const type of TYPE_ORDER) map.set(type, []);
    for (const insight of filtered) map.get(insight.type)?.push(insight);
    return map;
  }, [filtered]);

  const isEmpty = report && report.insights.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Insight Center"
        badge={
          report ? (
            <Badge variant="secondary" className="tabular-nums">
              {report.insights.length} insights
            </Badge>
          ) : null
        }
        description="Everything the analytics engines surface, combined into prioritized, actionable insights."
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
            variant="outline"
            onClick={() => void insightQuery.refetch()}
            disabled={insightQuery.isFetching}
          >
            <RefreshCwIcon className={insightQuery.isFetching ? "animate-spin" : undefined} />
            Refresh
          </Button>
        }
      />

      {insightQuery.isPending ? <InsightSkeleton /> : null}

      {insightQuery.error ? (
        <InventoryErrorState
          message={insightQuery.error.message}
          onRetry={() => void insightQuery.refetch()}
          isRetrying={insightQuery.isFetching}
        />
      ) : null}

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <SparklesIcon className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No insights yet</p>
            <p className="text-sm text-muted-foreground">
              Add items and log wears to generate wardrobe insights.
            </p>
          </div>
          <Button render={<Link href="/inventory" />}>Go to inventory</Button>
        </div>
      ) : null}

      {report && !isEmpty ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex items-start gap-3 pt-6">
              <SparklesIcon className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium">Summary</p>
                <p className="text-sm text-muted-foreground">{report.overallSummary}</p>
              </div>
            </CardContent>
          </Card>

          {report.topActions.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUpIcon className="size-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Top actions</h2>
                <Badge variant="secondary" className="tabular-nums">
                  {report.topActions.length}
                </Badge>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {report.topActions.map((insight) => (
                  <InsightCard key={`top-${insight.id}`} insight={insight} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-medium text-muted-foreground">Type</span>
                {TYPE_ORDER.map((type) => (
                  <FilterChip
                    key={type}
                    active={typeFilters.has(type)}
                    onClick={() => toggleType(type)}
                  >
                    {TYPE_META[type].label}
                  </FilterChip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-medium text-muted-foreground">Priority</span>
                {PRIORITY_ORDER.map((priority) => (
                  <FilterChip
                    key={priority}
                    active={priorityFilters.has(priority)}
                    onClick={() => togglePriority(priority)}
                  >
                    {priority}
                  </FilterChip>
                ))}
              </div>
              {filtersActive ? (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
                  <XIcon />
                  Clear
                </Button>
              ) : null}
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No insights match the selected filters.
              </p>
            ) : (
              TYPE_ORDER.map((type) => {
                const items = grouped.get(type) ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={type} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {SECTION_TITLE[type]}
                      </h3>
                      <Badge variant="secondary" className="tabular-nums">
                        {items.length}
                      </Badge>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {items.map((insight) => (
                        <InsightCard key={insight.id} insight={insight} />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
