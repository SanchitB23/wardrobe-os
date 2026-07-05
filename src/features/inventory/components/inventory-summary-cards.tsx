"use client";

import {
  LayersIcon,
  SparklesIcon,
  StarIcon,
  ShirtIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/shared/ui";
import { formatRating, type InventorySummary } from "@/types/wardrobe";

type InventorySummaryCardsProps = {
  summary: InventorySummary;
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
    description: "Go-to favorites",
    icon: SparklesIcon,
  },
  {
    key: "averageRating" as const,
    label: "Average rating",
    description: "Across rated items",
    icon: StarIcon,
  },
];

function formatSummaryValue(
  key: keyof InventorySummary,
  summary: InventorySummary,
) {
  if (key === "averageRating") {
    return summary.averageRating === null
      ? "—"
      : `${formatRating(summary.averageRating)}/10`;
  }
  return String(summary[key]);
}

export function InventorySummaryCards({ summary }: InventorySummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {SUMMARY_ITEMS.map(({ key, label, description, icon: Icon }) => (
        <StatCard
          key={key}
          label={label}
          value={formatSummaryValue(key, summary)}
          caption={description}
          icon={Icon}
        />
      ))}
    </div>
  );
}

export function InventorySummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
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
