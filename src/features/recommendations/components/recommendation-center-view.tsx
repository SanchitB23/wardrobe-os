"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  LightbulbIcon,
  RefreshCwIcon,
  ShirtIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";

import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { PageHeader } from "@/features/layout";
import {
  useOutfitRecommendations,
  type ItemPreview,
  type RecommendationFilters,
} from "@/features/recommendations/hooks";
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
import { ColorSwatch } from "@/shared/ui";
import { cn } from "@/lib/utils";
import type {
  CommuteMode,
  OutfitRecommendation,
  SeasonLabel,
  WeatherCondition,
} from "@/domain/recommendation";

type FilterGroup<T extends string> = {
  key: keyof RecommendationFilters;
  label: string;
  options: readonly T[];
};

const OCCASIONS = ["Office", "Casual", "Dinner", "Travel", "Gym", "Wedding"] as const;
const SEASONS: readonly SeasonLabel[] = ["summer", "monsoon", "autumn", "winter", "spring"];
const WEATHER: readonly WeatherCondition[] = ["hot", "warm", "mild", "cool", "cold", "rainy"];
const COMMUTES: readonly CommuteMode[] = ["wfh", "metro", "car", "walk", "mixed"];

function scoreTone(score: number): string {
  if (score >= 8) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 6.5) return "text-blue-600 dark:text-blue-400";
  if (score >= 5) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
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
        "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium capitalize transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function OutfitPreview({
  recommendation,
  previews,
  size = "md",
}: {
  recommendation: OutfitRecommendation;
  previews: Record<string, ItemPreview>;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {recommendation.items.map((item) => {
        const preview = previews[item.itemId];
        const color = preview?.color ?? item.name;
        return (
          <div
            key={item.itemId}
            className="flex items-center gap-1.5 rounded-full border bg-muted/30 py-1 pl-1 pr-2.5"
            title={`${item.name}${preview?.color ? ` · ${preview.color}` : ""}`}
          >
            <ColorSwatch colorName={color} family={null} size={size === "lg" ? "lg" : "md"} />
            <span className="max-w-32 truncate text-xs">{item.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function ActionButtons({ rec }: { rec: OutfitRecommendation }) {
  const isSaved = rec.metadata.source === "saved_outfit" && rec.outfitId;
  return (
    <div className="flex flex-wrap gap-2">
      {isSaved ? (
        <Button size="sm" render={<Link href={`/outfits/${rec.outfitId}`} />}>
          <ShirtIcon />
          Wear outfit
        </Button>
      ) : (
        <Button size="sm" disabled>
          <ShirtIcon />
          Wear outfit
        </Button>
      )}
      {isSaved ? (
        <Button size="sm" variant="outline" disabled>
          <CheckCircleIcon />
          Saved
        </Button>
      ) : (
        <Button size="sm" variant="outline" render={<Link href="/outfits/new" />}>
          <SparklesIcon />
          Save outfit
        </Button>
      )}
    </div>
  );
}

function MetaList({
  title,
  icon: Icon,
  items,
  tone,
}: {
  title: string;
  icon: typeof CheckCircleIcon;
  items: string[];
  tone: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className={cn("size-3.5", tone)} />
        {title}
      </p>
      <ul className="space-y-0.5 text-sm">
        {items.map((entry, index) => (
          <li key={index} className="text-muted-foreground">
            {entry}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreConfidence({ rec }: { rec: OutfitRecommendation }) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-right">
        <span className={cn("text-2xl font-semibold tabular-nums", scoreTone(rec.score))}>
          {rec.score.toFixed(1)}
        </span>
        <span className="text-sm text-muted-foreground">/10</span>
      </div>
      <Badge variant="secondary" className="tabular-nums">
        {Math.round(rec.confidence * 100)}% confidence
      </Badge>
    </div>
  );
}

function HeroCard({
  rec,
  previews,
}: {
  rec: OutfitRecommendation;
  previews: Record<string, ItemPreview>;
}) {
  return (
    <Card className="border-foreground/15 bg-gradient-to-br from-muted/40 to-background">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <WandSparklesIcon className="size-5 text-blue-600 dark:text-blue-400" />
            <Badge variant="secondary">Top pick</Badge>
            <Badge variant="outline" className="capitalize">
              {rec.metadata.source === "saved_outfit" ? "Saved outfit" : "Fresh combo"}
            </Badge>
          </div>
          <ScoreConfidence rec={rec} />
        </div>
        <CardTitle className="text-xl">{rec.name}</CardTitle>
        <CardDescription>{rec.reason}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <OutfitPreview recommendation={rec} previews={previews} size="lg" />
        <div className="grid gap-5 sm:grid-cols-3">
          <MetaList title="Strengths" icon={CheckCircleIcon} items={rec.strengths} tone="text-emerald-600 dark:text-emerald-400" />
          <MetaList title="Tradeoffs" icon={AlertTriangleIcon} items={rec.tradeoffs} tone="text-amber-600 dark:text-amber-400" />
          <MetaList title="Suggestions" icon={LightbulbIcon} items={rec.suggestions} tone="text-blue-600 dark:text-blue-400" />
        </div>
        <ActionButtons rec={rec} />
      </CardContent>
    </Card>
  );
}

function RecommendationCard({
  rec,
  previews,
}: {
  rec: OutfitRecommendation;
  previews: Record<string, ItemPreview>;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="capitalize">
            {rec.metadata.source === "saved_outfit" ? "Saved" : "Combo"}
          </Badge>
          <ScoreConfidence rec={rec} />
        </div>
        <CardTitle className="text-base">{rec.name}</CardTitle>
        <CardDescription>{rec.reason}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <OutfitPreview recommendation={rec} previews={previews} />
        <div className="space-y-3">
          <MetaList title="Strengths" icon={CheckCircleIcon} items={rec.strengths.slice(0, 3)} tone="text-emerald-600 dark:text-emerald-400" />
          <MetaList title="Tradeoffs" icon={AlertTriangleIcon} items={rec.tradeoffs.slice(0, 2)} tone="text-amber-600 dark:text-amber-400" />
        </div>
        <div className="mt-auto pt-1">
          <ActionButtons rec={rec} />
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function RecommendationCenterView() {
  const [filters, setFilters] = useState<RecommendationFilters>({});
  const query = useOutfitRecommendations(filters);
  const data = query.data;

  function setSingle<K extends "occasion" | "season" | "weather" | "commute">(
    key: K,
    value: NonNullable<RecommendationFilters[K]>,
  ) {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? undefined : value,
    }));
  }

  const groups: FilterGroup<string>[] = [
    { key: "occasion", label: "Occasion", options: OCCASIONS },
    { key: "season", label: "Season", options: SEASONS },
    { key: "weather", label: "Weather", options: WEATHER },
    { key: "commute", label: "Commute", options: COMMUTES },
  ];

  const recommendations = data?.recommendations ?? [];
  const previews = data?.previews ?? {};
  const [hero, ...rest] = recommendations;
  const topRecs = rest.slice(0, 4);
  const alternatives = rest.slice(4);
  const isEmpty = data && recommendations.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Recommendations"
        badge={
          data ? (
            <Badge variant="secondary" className="tabular-nums">
              {recommendations.length} outfits
            </Badge>
          ) : null
        }
        description="Ranked outfit recommendations from your saved outfits and wardrobe — tuned to occasion, weather, and commute."
        breadcrumb={
          <Button variant="ghost" size="sm" className="-ml-2" render={<Link href="/dashboard" />}>
            <ArrowLeftIcon />
            Dashboard
          </Button>
        }
        actions={
          <Button
            variant="outline"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCwIcon className={query.isFetching ? "animate-spin" : undefined} />
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3">
        {groups.map((group) => (
          <div key={group.key as string} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 w-20 shrink-0 text-xs font-medium text-muted-foreground">
              {group.label}
            </span>
            {group.options.map((option) => (
              <FilterChip
                key={option}
                active={filters[group.key] === option}
                onClick={() =>
                  setSingle(
                    group.key as "occasion" | "season" | "weather" | "commute",
                    option,
                  )
                }
              >
                {option}
              </FilterChip>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-20 shrink-0 text-xs font-medium text-muted-foreground">
            Favorites
          </span>
          <FilterChip
            active={Boolean(filters.favoritesOnly)}
            onClick={() =>
              setFilters((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))
            }
          >
            Favorites only
          </FilterChip>
        </div>
      </div>

      {query.isPending ? <RecommendationsSkeleton /> : null}

      {query.error ? (
        <InventoryErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : null}

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <WandSparklesIcon className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No recommendations yet</p>
            <p className="text-sm text-muted-foreground">
              Save outfits or add tops, bottoms, and footwear to your wardrobe to
              get recommendations.
            </p>
          </div>
          <Button render={<Link href="/outfits/new" />}>Create an outfit</Button>
        </div>
      ) : null}

      {hero ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Hero recommendation</h2>
          <HeroCard rec={hero} previews={previews} />
        </section>
      ) : null}

      {topRecs.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Top recommendations</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {topRecs.map((rec, index) => (
              <RecommendationCard
                key={rec.outfitId ?? `top-${index}`}
                rec={rec}
                previews={previews}
              />
            ))}
          </div>
        </section>
      ) : null}

      {alternatives.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            Alternative recommendations
          </h2>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {alternatives.map((rec, index) => (
              <RecommendationCard
                key={rec.outfitId ?? `alt-${index}`}
                rec={rec}
                previews={previews}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
