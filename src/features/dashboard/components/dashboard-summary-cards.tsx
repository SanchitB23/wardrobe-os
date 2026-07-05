"use client";

import Link from "next/link";
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
import type { DashboardSummary } from "@/features/dashboard/types";
import { formatRating } from "@/types/wardrobe";

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

const SUMMARY_HREFS: Record<keyof DashboardSummary, string> = {
  totalItems: "/inventory",
  activeItems: "/inventory?status=active",
  heroPieces: "/inventory?usage=hero",
  favorites: "/inventory?favorite=true",
  averageRating: "/inventory?sort=rating_desc",
};

export function DashboardSummaryCards({ summary }: DashboardSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {SUMMARY_ITEMS.map(({ key, label, description, icon: Icon }) => (
        <Link
          key={key}
          href={SUMMARY_HREFS[key]}
          className="group/stat rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card
            size="sm"
            className="h-full cursor-pointer transition-shadow group-hover/stat:border-foreground/20 group-hover/stat:shadow-md"
          >
            <CardHeader className="pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="text-3xl font-semibold tabular-nums">
                    {formatSummaryValue(key, summary)}
                  </CardTitle>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover/stat:bg-primary/10">
                  <Icon className="size-4 text-muted-foreground transition-colors group-hover/stat:text-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        </Link>
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
