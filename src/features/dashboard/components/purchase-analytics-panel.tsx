"use client";

import Link from "next/link";

import { SpendingChart } from "@/features/purchases/components/spending-chart";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatCurrency,
  type PurchaseAnalytics,
} from "@/types/wardrobe";

type PurchaseAnalyticsPanelProps = {
  purchaseInsights: PurchaseAnalytics;
};

function SummaryMetric({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Card size="sm">
      <CardHeader className="pb-0">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function HighlightCard({
  title,
  description,
  item,
  emptyMessage,
}: {
  title: string;
  description: string;
  item: PurchaseAnalytics["mostExpensiveItem"];
  emptyMessage: string;
}) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {item ? (
          <Link
            href={`/inventory/${item.id}`}
            className="group flex flex-col gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-muted/50"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium group-hover:underline">
                {item.name}
              </span>
              <Badge variant="secondary" className="tabular-nums">
                {formatCurrency(item.price)}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{item.code}</span>
              {item.brand ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{item.brand}</span>
                </>
              ) : null}
            </div>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function PurchaseAnalyticsPanel({
  purchaseInsights,
}: PurchaseAnalyticsPanelProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Purchase analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Wardrobe value, cost-per-wear, and spending patterns.
          </p>
        </div>
        <Link
          href="/purchases"
          className="text-sm font-medium text-primary hover:underline"
        >
          View purchase history
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          label="Total wardrobe value"
          value={formatCurrency(purchaseInsights.totalWardrobeValue)}
          description="Sum of active purchase prices"
        />
        <SummaryMetric
          label="Average cost per wear"
          value={
            purchaseInsights.averageCostPerWear !== null
              ? formatCurrency(purchaseInsights.averageCostPerWear)
              : "Not enough data"
          }
          description="Total value divided by total wears"
        />
        <HighlightCard
          title="Most expensive item"
          description="Highest purchase price in your wardrobe."
          item={purchaseInsights.mostExpensiveItem}
          emptyMessage="No purchases recorded yet."
        />
        <HighlightCard
          title="Cheapest item"
          description="Lowest purchase price in your wardrobe."
          item={purchaseInsights.cheapestItem}
          emptyMessage="No purchases recorded yet."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SpendingChart
          title="Monthly purchase timeline"
          description="Spending by purchase month."
          items={purchaseInsights.monthlyTimeline.map((entry) => ({
            id: entry.month,
            name: entry.label,
            amount: entry.amount,
          }))}
        />
        <SpendingChart
          title="Spending by brand"
          description="Total spend grouped by brand."
          items={purchaseInsights.spendingByBrand}
        />
        <SpendingChart
          title="Spending by category"
          description="Total spend grouped by category."
          items={purchaseInsights.spendingByCategory}
        />
      </div>

      <SpendingChart
        title="Top 10 most valuable brands"
        description="Brands with the highest total purchase value."
        items={purchaseInsights.topBrandsByValue}
        emptyMessage="No brand spending data yet."
      />
    </section>
  );
}
