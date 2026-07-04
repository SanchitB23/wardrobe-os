"use client";

import Link from "next/link";
import { LayoutGridIcon, RefreshCwIcon, ShirtIcon, CalendarDaysIcon, ReceiptIcon, LayersIcon } from "lucide-react";

import {
  DashboardSummaryCards,
  DashboardSummaryCardsSkeleton,
} from "@/components/dashboard/dashboard-summary-cards";
import { DistributionPanel } from "@/components/dashboard/distribution-panel";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { WearInsightsPanel } from "@/components/dashboard/wear-insights-panel";
import { PurchaseAnalyticsPanel } from "@/components/dashboard/purchase-analytics-panel";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWardrobeDashboard } from "@/lib/wardrobe/hooks";
import type { DashboardSummary } from "@/types/wardrobe";

const EMPTY_SUMMARY: DashboardSummary = {
  totalItems: 0,
  activeItems: 0,
  heroPieces: 0,
  averageRating: null,
  favorites: 0,
};

function DistributionSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl ring-1 ring-foreground/10 p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function WardrobeDashboard() {
  const dashboardQuery = useWardrobeDashboard();
  const isInitialLoading = dashboardQuery.isPending;
  const isRefetching =
    dashboardQuery.isFetching && !dashboardQuery.isPending;
  const error = dashboardQuery.error?.message ?? null;
  const analytics = dashboardQuery.data;

  function handleRetry() {
    void dashboardQuery.refetch();
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            {!isInitialLoading && !error && analytics ? (
              <Badge variant="secondary" className="tabular-nums">
                {analytics.summary.totalItems} items
              </Badge>
            ) : null}
            {isRefetching ? (
              <Badge variant="outline" className="text-muted-foreground">
                Updating…
              </Badge>
            ) : null}
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Analytics across your wardrobe catalog — categories, brands, usage,
            and health insights.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/purchases" />}>
            <ReceiptIcon />
            Purchases
          </Button>
          <Button variant="outline" render={<Link href="/wear-logs" />}>
            <CalendarDaysIcon />
            Wear logs
          </Button>
          <Button variant="outline" render={<Link href="/outfits" />}>
            <LayersIcon />
            Outfits
          </Button>
          <Button variant="outline" render={<Link href="/inventory" />}>
            <ShirtIcon />
            Inventory
          </Button>
          <Button
            variant="outline"
            onClick={handleRetry}
            disabled={dashboardQuery.isFetching}
          >
            <RefreshCwIcon
              className={dashboardQuery.isFetching ? "animate-spin" : undefined}
            />
            Refresh
          </Button>
        </div>
      </header>

      {error ? (
        <InventoryErrorState
          message={error}
          onRetry={handleRetry}
          isRetrying={dashboardQuery.isFetching}
        />
      ) : null}

      {!error ? (
        <>
          {isInitialLoading ? (
            <DashboardSummaryCardsSkeleton />
          ) : (
            <DashboardSummaryCards
              summary={analytics?.summary ?? EMPTY_SUMMARY}
            />
          )}

          {isInitialLoading ? (
            <DistributionSkeleton />
          ) : (
            <>
              <section className="grid gap-4 lg:grid-cols-2">
                <DistributionPanel
                  title="Category distribution"
                  description="Item count by category."
                  items={analytics?.categories ?? []}
                />
                <DistributionPanel
                  title="Subcategory distribution"
                  description="Top subcategories by item count."
                  items={analytics?.subcategories ?? []}
                />
                <DistributionPanel
                  title="Brand distribution"
                  description="Top 10 brands in your wardrobe."
                  items={analytics?.brands ?? []}
                />
                <DistributionPanel
                  title="Color distribution"
                  description="Primary colors across items."
                  items={analytics?.colors ?? []}
                  showColorBadge
                />
              </section>

              <section className="grid gap-4 lg:grid-cols-3">
                <DistributionPanel
                  title="Usage distribution"
                  description="How often pieces are worn."
                  items={
                    analytics?.usage.map((entry) => ({
                      id: entry.value,
                      name: entry.label,
                      count: entry.count,
                    })) ?? []
                  }
                />
                <DistributionPanel
                  title="Formality distribution"
                  description="Formality levels across items."
                  items={
                    analytics?.formality.map((entry) => ({
                      id: entry.value,
                      name: entry.label,
                      count: entry.count,
                    })) ?? []
                  }
                />
                <DistributionPanel
                  title="Season distribution"
                  description="Items tagged per season."
                  items={analytics?.seasons ?? []}
                  emptyMessage="No season tags yet."
                />
              </section>

              {analytics ? <InsightsPanel insights={analytics.insights} /> : null}
              {analytics ? (
                <WearInsightsPanel wearInsights={analytics.wearInsights} />
              ) : null}
              {analytics ? (
                <PurchaseAnalyticsPanel
                  purchaseInsights={analytics.purchaseInsights}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}

      {!error && !isInitialLoading && analytics?.summary.totalItems === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <LayoutGridIcon className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No wardrobe data yet</p>
            <p className="text-sm text-muted-foreground">
              Add items to your inventory to populate dashboard analytics.
            </p>
          </div>
          <Button render={<Link href="/inventory" />}>Go to inventory</Button>
        </div>
      ) : null}
    </div>
  );
}
