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
import type {
  AnalyticsDistributionItem,
  AnalyticsInsightItem,
  WardrobeDashboardAnalytics,
} from "@/types/wardrobe";
import { formatEnumLabel, formatRating } from "@/types/wardrobe";

type InsightsPanelProps = {
  insights: WardrobeDashboardAnalytics["insights"];
};

function InsightList({
  title,
  description,
  items,
  emptyMessage,
  showRating = false,
}: {
  title: string;
  description: string;
  items: AnalyticsInsightItem[] | AnalyticsDistributionItem[];
  emptyMessage: string;
  showRating?: boolean;
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
            {items.map((item) => {
              if ("code" in item) {
                const insight = item;
                return (
                  <li key={insight.id}>
                    <Link
                      href={`/inventory/${insight.id}`}
                      className="group flex flex-col gap-1 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium leading-snug group-hover:underline">
                          {insight.name}
                        </span>
                        {showRating && insight.rating !== null ? (
                          <Badge variant="secondary" className="tabular-nums">
                            {formatRating(insight.rating)}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{insight.code}</span>
                        {insight.category ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{insight.category}</span>
                          </>
                        ) : null}
                        {insight.usage ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{formatEnumLabel(insight.usage)}</span>
                          </>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              }

              const category = item;
              return (
                <li
                  key={category.id ?? category.name}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                >
                  <span className="font-medium">{category.name}</span>
                  <Badge variant="secondary" className="tabular-nums">
                    {category.count}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Wardrobe health insights
        </h2>
        <p className="text-sm text-muted-foreground">
          Highlights to help you spot strengths, gaps, and underused pieces.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <InsightList
          title="Highest rated"
          description="Top-scoring pieces in your catalog."
          items={insights.highestRated}
          emptyMessage="No rated items yet."
          showRating
        />
        <InsightList
          title="Lowest rated active"
          description="Active items that may need review."
          items={insights.lowestRatedActive}
          emptyMessage="No active rated items yet."
          showRating
        />
        <InsightList
          title="Rare usage"
          description="Pieces marked as rarely worn."
          items={insights.rareUsage}
          emptyMessage="No rare-usage items."
        />
        <InsightList
          title="Largest categories"
          description="Categories with the most items."
          items={insights.highCountCategories}
          emptyMessage="No categorized items yet."
        />
      </div>
    </section>
  );
}
