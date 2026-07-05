"use client";

import Link from "next/link";
import { HeartPulseIcon, LayoutGridIcon, RefreshCwIcon } from "lucide-react";

import {
  DashboardSummaryCards,
  DashboardSummaryCardsSkeleton,
} from "@/features/dashboard/components/dashboard-summary-cards";
import { DistributionPanel } from "@/features/dashboard/components/distribution-panel";
import { InsightsPanel } from "@/features/dashboard/components/insights-panel";
import { WearInsightsPanel } from "@/features/dashboard/components/wear-insights-panel";
import { PurchaseAnalyticsPanel } from "@/features/dashboard/components/purchase-analytics-panel";
import { useWardrobeDashboard } from "@/features/dashboard/hooks";
import type { DashboardSummary } from "@/features/dashboard/types";
import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { buildInventoryHref as inventoryHref } from "@/features/inventory/lib/inventory-view";
import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
      <PageHeader
        title="Dashboard"
        badge={
          <>
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
          </>
        }
        description="Analytics across your wardrobe catalog — categories, brands, usage, and health insights."
        actions={
          <>
            <Button variant="outline" render={<Link href="/dashboard/health" />}>
              <HeartPulseIcon />
              Wardrobe health
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
          </>
        }
      />

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
                  hrefFor={(row) => inventoryHref({ category: row.name })}
                />
                <DistributionPanel
                  title="Subcategory distribution"
                  description="Top subcategories by item count."
                  items={analytics?.subcategories ?? []}
                  hrefFor={(row) => inventoryHref({ subcategory: row.name })}
                />
                <DistributionPanel
                  title="Brand distribution"
                  description="Top 10 brands in your wardrobe."
                  items={analytics?.brands ?? []}
                  hrefFor={(row) => inventoryHref({ brand: row.name })}
                />
                <DistributionPanel
                  title="Color distribution"
                  description="Primary colors across items."
                  items={analytics?.colors ?? []}
                  showColorBadge
                  hrefFor={(row) => inventoryHref({ color: row.name })}
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
                  hrefFor={(row) =>
                    row.id ? inventoryHref({ usage: row.id }) : "/inventory"
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
                  hrefFor={(row) =>
                    row.id ? inventoryHref({ formality: row.id }) : "/inventory"
                  }
                />
                <DistributionPanel
                  title="Season distribution"
                  description="Items tagged per season."
                  items={analytics?.seasons ?? []}
                  emptyMessage="No season tags yet."
                  hrefFor={(row) => inventoryHref({ season: row.name })}
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
