"use client";

import {
  HeartIcon,
  LayersIcon,
  SparklesIcon,
  StarIcon,
  ShirtIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRating, type DashboardSummary } from "@/types/wardrobe";

type DashboardSummaryCardsProps = {
  summary: DashboardSummary;
};

const SUMMARY_ITEMS = [
  {
    key: "totalItems" as const,
    label: "Total items",
    description: "Pieces in your catalog",
    icon: ShirtIcon,
  },
  {
    key: "activeItems" as const,
    label: "Active items",
    description: "Currently in rotation",
    icon: LayersIcon,
  },
  {
    key: "heroPieces" as const,
    label: "Hero pieces",
    description: "Highest-usage staples",
    icon: SparklesIcon,
  },
  {
    key: "averageRating" as const,
    label: "Average rating",
    description: "Across rated items",
    icon: StarIcon,
  },
  {
    key: "favorites" as const,
    label: "Favorites",
    description: "Marked as favorites",
    icon: HeartIcon,
  },
];

function formatSummaryValue(key: keyof DashboardSummary, summary: DashboardSummary) {
  if (key === "averageRating") {
    return summary.averageRating === null
      ? "—"
      : `${formatRating(summary.averageRating)}/10`;
  }
  return String(summary[key]);
}

export function DashboardSummaryCards({ summary }: DashboardSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {SUMMARY_ITEMS.map(({ key, label, description, icon: Icon }) => (
        <Card key={key} size="sm">
          <CardHeader className="pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-3xl font-semibold tabular-nums">
                  {formatSummaryValue(key, summary)}
                </CardTitle>
              </div>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-4 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardSummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index} size="sm">
          <CardHeader className="pb-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-9 w-16" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
