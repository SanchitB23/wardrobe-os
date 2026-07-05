"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  CoinsIcon,
  LightbulbIcon,
  RefreshCwIcon,
  ShirtIcon,
  SparklesIcon,
} from "lucide-react";

import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { PageHeader } from "@/features/layout";
import { useUsageAnalytics } from "@/features/analytics/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  CategoryUsageSummary,
  ItemCostSummary,
  ItemSummary,
  ItemUsageSummary,
  OccasionUsageSummary,
  UsageAnalytics,
} from "@/domain/analytics/UsageAnalyticsEngine";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof ShirtIcon;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-0.5">
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function daysLabel(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function UsageItemsCard({
  title,
  description,
  items,
  empty,
  showLastWorn = true,
}: {
  title: string;
  description: string;
  items: ItemUsageSummary[];
  empty: string;
  showLastWorn?: boolean;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="secondary" className="ml-auto tabular-nums">
            {items.length}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-x-auto">
        {items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Wears</TableHead>
                {showLastWorn ? (
                  <TableHead className="text-right">Last worn</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.name}</span>
                    {item.category ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {item.category}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.wearCount}
                  </TableCell>
                  {showLastWorn ? (
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {daysLabel(item.daysSinceLastWorn)}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function NeverWornCard({ items }: { items: ItemSummary[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Never worn</CardTitle>
          <Badge variant="secondary" className="ml-auto tabular-nums">
            {items.length}
          </Badge>
        </div>
        <CardDescription>Active items with no logged wears.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {items.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {items.slice(0, 12).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{item.name}</span>
                {item.category ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.category}
                  </span>
                ) : null}
              </li>
            ))}
            {items.length > 12 ? (
              <li className="text-xs text-muted-foreground">
                +{items.length - 12} more
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Every active item has been worn at least once.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryUsageCard({ rows }: { rows: CategoryUsageSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Category usage</CardTitle>
        <CardDescription>
          Ownership vs. wear — how much each category earns its place.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Wears</TableHead>
                <TableHead className="text-right">Wears/item</TableHead>
                <TableHead className="w-40">Utilization</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const worn = row.itemCount - row.neverWornCount;
                const utilization =
                  row.itemCount > 0
                    ? Math.round((worn / row.itemCount) * 100)
                    : 0;
                return (
                  <TableRow key={row.category}>
                    <TableCell className="font-medium">{row.category}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.itemCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.wearCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.wearsPerItem}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={utilization}
                          max={100}
                          aria-label={`${row.category} utilization`}
                          className="flex-1"
                        />
                        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {utilization}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No category data yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function OccasionUsageCard({ rows }: { rows: OccasionUsageSummary[] }) {
  const max = rows.reduce((peak, row) => Math.max(peak, row.wearCount), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage by occasion</CardTitle>
        <CardDescription>Where your wears actually happen.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={row.occasion} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{row.occasion}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.wearCount} wears · {row.itemCount} items
                </span>
              </div>
              <Progress
                value={max > 0 ? (row.wearCount / max) * 100 : 0}
                max={100}
                aria-label={`${row.occasion} wears`}
              />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No occasion data on wear logs yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CostPerWearCard({
  title,
  description,
  items,
  tone,
}: {
  title: string;
  description: string;
  items: ItemCostSummary[];
  tone: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CoinsIcon className={cn("size-4", tone)} />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Wears</TableHead>
              <TableHead className="text-right">Cost/wear</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-right tabular-nums">{item.price}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.wearCount}
                </TableCell>
                <TableCell className={cn("text-right font-semibold tabular-nums", tone)}>
                  {item.costPerWear}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
  icon: typeof LightbulbIcon;
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

function UsageReport({ usage }: { usage: UsageAnalytics }) {
  const cpw = usage.costPerWearHighlights;
  const hasCpw = Boolean(cpw && (cpw.bestValue.length > 0 || cpw.worstValue.length > 0));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total wears" value={usage.totalWears} icon={SparklesIcon} />
        <StatCard label="Items worn" value={usage.wornItemCount} icon={ShirtIcon} />
        <StatCard
          label="Never worn"
          value={usage.neverWornItems.length}
          icon={ShirtIcon}
        />
        <StatCard
          label="Stale (90+ days)"
          value={usage.staleItems.length}
          icon={RefreshCwIcon}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <NarrativeCard
          title="Insights"
          description="What the wear data shows."
          icon={SparklesIcon}
          items={usage.insights}
          empty="No insights yet."
          tone="text-blue-600 dark:text-blue-400"
        />
        <NarrativeCard
          title="Recommendations"
          description="Ways to get more from your wardrobe."
          icon={LightbulbIcon}
          items={usage.recommendations}
          empty="Nothing to recommend right now."
          tone="text-amber-600 dark:text-amber-400"
        />
        <NeverWornCard items={usage.neverWornItems} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <UsageItemsCard
          title="Most worn"
          description="Your hardest-working pieces."
          items={usage.mostWornItems}
          empty="No wears logged yet."
        />
        <UsageItemsCard
          title="Least worn (active)"
          description="Worn, but rarely — excludes rare & formal."
          items={usage.leastWornActiveItems}
          empty="Nothing underused."
        />
        <UsageItemsCard
          title="Stale favorites"
          description="Not worn in 90+ days — excludes rare & formal."
          items={usage.staleItems}
          empty="No stale items."
        />
      </div>

      <CategoryUsageCard rows={usage.categoryUsage} />
      <OccasionUsageCard rows={usage.usageByOccasion} />

      {hasCpw && cpw ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <CostPerWearCard
            title="Best value"
            description="Lowest cost per wear."
            items={cpw.bestValue}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <CostPerWearCard
            title="Worst value"
            description="Highest cost per wear."
            items={cpw.worstValue}
            tone="text-destructive"
          />
        </div>
      ) : null}
    </div>
  );
}

function UsageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-56 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function UsageAnalyticsView() {
  const usageQuery = useUsageAnalytics();
  const usage = usageQuery.data;
  const isEmpty =
    usage &&
    usage.totalWears === 0 &&
    usage.neverWornItems.length === 0 &&
    usage.categoryUsage.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Usage Analytics"
        badge={
          usage ? (
            <Badge variant="secondary" className="tabular-nums">
              {usage.totalWears} wears
            </Badge>
          ) : null
        }
        description="How your wardrobe is actually worn — most-worn, never-worn, stale pieces, and cost-per-wear."
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
            onClick={() => void usageQuery.refetch()}
            disabled={usageQuery.isFetching}
          >
            <RefreshCwIcon className={usageQuery.isFetching ? "animate-spin" : undefined} />
            Refresh
          </Button>
        }
      />

      {usageQuery.isPending ? <UsageSkeleton /> : null}

      {usageQuery.error ? (
        <InventoryErrorState
          message={usageQuery.error.message}
          onRetry={() => void usageQuery.refetch()}
          isRetrying={usageQuery.isFetching}
        />
      ) : null}

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <CheckCircleIcon className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No usage data yet</p>
            <p className="text-sm text-muted-foreground">
              Log wears from an item or outfit to see usage analytics.
            </p>
          </div>
          <Button render={<Link href="/wear-logs" />}>Go to wear logs</Button>
        </div>
      ) : null}

      {usage && !isEmpty ? <UsageReport usage={usage} /> : null}
    </div>
  );
}
