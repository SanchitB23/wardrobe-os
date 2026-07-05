"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatWearLogDisplayDate } from "@/features/wear-logs/services/wear-logs.service";
import type { WearAnalyticsItem, WearLogAnalytics } from "@/types/wardrobe";

type WearInsightsPanelProps = {
  wearInsights: WearLogAnalytics;
};

function WearInsightList({
  title,
  description,
  items,
  emptyMessage,
  showWearCount = false,
  showLastWorn = false,
}: {
  title: string;
  description: string;
  items: WearAnalyticsItem[];
  emptyMessage: string;
  showWearCount?: boolean;
  showLastWorn?: boolean;
}) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/inventory/${item.id}`}
                  className="group flex flex-col gap-1 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium leading-snug group-hover:underline">
                      {item.name}
                    </span>
                    {showWearCount ? (
                      <Badge variant="secondary" className="tabular-nums">
                        {item.wearCount}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.code}</span>
                    {item.category ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{item.category}</span>
                      </>
                    ) : null}
                    {showLastWorn && item.lastWornOn ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{formatWearLogDisplayDate(item.lastWornOn)}</span>
                      </>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function WearInsightsPanel({ wearInsights }: WearInsightsPanelProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Wear analytics</h2>
          <p className="text-sm text-muted-foreground">
            Usage patterns from logged wears across your wardrobe.
          </p>
        </div>
        <Link
          href="/wear-logs"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all wear logs
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <WearInsightList
          title="Most worn"
          description="Items with the highest wear counts."
          items={wearInsights.mostWorn}
          emptyMessage="No wear logs yet."
          showWearCount
        />
        <WearInsightList
          title="Least worn active"
          description="Active items with the fewest logged wears."
          items={wearInsights.leastWornActive}
          emptyMessage="No active items with wear logs yet."
          showWearCount
        />
        <WearInsightList
          title="Not worn yet"
          description="Active items without any logged wears."
          items={wearInsights.notWornYet}
          emptyMessage="Every active item has at least one wear log."
        />
        <WearInsightList
          title="Recently worn"
          description="Items worn most recently."
          items={wearInsights.recentlyWorn}
          emptyMessage="No recent wears logged."
          showLastWorn
        />
      </div>
    </section>
  );
}
