"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  HeartIcon,
  LayersIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SearchXIcon,
} from "lucide-react";

import { PageHeader } from "@/features/layout";
import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteOutfitDialog } from "@/features/outfits/components/delete-outfit-dialog";
import { OutfitCard } from "@/features/outfits/components/outfit-card";
import { WearOutfitDialog } from "@/features/outfits/components/wear-outfit-dialog";
import {
  useDuplicateOutfitMutation,
  useOutfit,
  useOutfitLookups,
  useOutfitScores,
  useOutfits,
  useToggleOutfitFavoriteMutation,
} from "@/features/outfits/hooks";
import type { OutfitListRow } from "@/features/outfits/types";

type ScoreRangeFilter = "any" | "high" | "mid" | "low";
type MinRatingFilter = "any" | "8" | "6" | "4";

const SCORE_RANGE_LABELS: Record<ScoreRangeFilter, string> = {
  any: "Any score",
  high: "8 and above",
  mid: "6 to 7.9",
  low: "Below 6",
};

const MIN_RATING_LABELS: Record<MinRatingFilter, string> = {
  any: "Any rating",
  "8": "8+",
  "6": "6+",
  "4": "4+",
};

function matchesScoreRange(
  score: number | undefined,
  range: ScoreRangeFilter,
): boolean {
  if (range === "any") {
    return true;
  }
  if (score === undefined) {
    return false;
  }
  if (range === "high") {
    return score >= 8;
  }
  if (range === "mid") {
    return score >= 6 && score < 8;
  }
  return score < 6;
}

function OutfitsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-80 rounded-xl" />
      ))}
    </div>
  );
}

export function OutfitsView() {
  const outfitsQuery = useOutfits();
  const lookupsQuery = useOutfitLookups();
  const scoresQuery = useOutfitScores();
  const duplicateMutation = useDuplicateOutfitMutation();
  const favoriteMutation = useToggleOutfitFavoriteMutation();

  const [outfitToDelete, setOutfitToDelete] = useState<OutfitListRow | null>(
    null,
  );
  const [outfitToWear, setOutfitToWear] = useState<OutfitListRow | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [occasionId, setOccasionId] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<MinRatingFilter>("any");
  const [scoreRange, setScoreRange] = useState<ScoreRangeFilter>("any");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const wearDetailQuery = useOutfit(outfitToWear?.id ?? "");

  const outfits = outfitsQuery.data ?? [];
  const lookups = lookupsQuery.data ?? { occasions: [], seasons: [], categories: [] };
  const scores = scoresQuery.data ?? {};
  const isInitialLoading = outfitsQuery.isPending && !outfitsQuery.data;
  const isRefetching = outfitsQuery.isFetching && !outfitsQuery.isPending;

  const selectedOccasionName =
    lookups.occasions.find((occasion) => occasion.id === occasionId)?.name ?? null;
  const selectedSeasonName =
    lookups.seasons.find((season) => season.id === seasonId)?.name ?? null;

  const hasActiveFilters =
    search.trim() !== "" ||
    occasionId !== null ||
    seasonId !== null ||
    minRating !== "any" ||
    scoreRange !== "any" ||
    favoritesOnly;

  const filteredOutfits = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return outfits.filter((outfit) => {
      if (needle && !outfit.name.toLowerCase().includes(needle)) {
        return false;
      }
      if (occasionId && outfit.occasion?.id !== occasionId) {
        return false;
      }
      if (seasonId && outfit.season?.id !== seasonId) {
        return false;
      }
      if (minRating !== "any") {
        if (outfit.rating === null || outfit.rating < Number(minRating)) {
          return false;
        }
      }
      if (!matchesScoreRange(scores[outfit.id], scoreRange)) {
        return false;
      }
      if (favoritesOnly && !outfit.favorite) {
        return false;
      }
      return true;
    });
  }, [outfits, search, occasionId, seasonId, minRating, scoreRange, favoritesOnly, scores]);

  function handleRetry() {
    void outfitsQuery.refetch();
  }

  function clearFilters() {
    setSearch("");
    setOccasionId(null);
    setSeasonId(null);
    setMinRating("any");
    setScoreRange("any");
    setFavoritesOnly(false);
  }

  async function handleDuplicate(outfit: OutfitListRow) {
    setDuplicatingId(outfit.id);
    try {
      await duplicateMutation.mutateAsync(outfit.id);
    } catch {
      // Mutation onError shows toast.
    } finally {
      setDuplicatingId(null);
    }
  }

  function handleToggleFavorite(outfit: OutfitListRow) {
    favoriteMutation.mutate({ id: outfit.id, favorite: !outfit.favorite });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Outfits"
        badge={
          <>
            {!isInitialLoading && !outfitsQuery.error ? (
              <Badge variant="secondary" className="tabular-nums">
                {outfits.length} saved
              </Badge>
            ) : null}
            {isRefetching ? (
              <Badge variant="outline" className="text-muted-foreground">
                Updating…
              </Badge>
            ) : null}
          </>
        }
        description="Build complete looks from your wardrobe — assign tops, bottoms, footwear, and optional layers."
        actions={
          <>
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={outfitsQuery.isFetching}
            >
              <RefreshCwIcon
                className={outfitsQuery.isFetching ? "animate-spin" : undefined}
              />
              Refresh
            </Button>
            <Button render={<Link href="/outfits/new" />}>
              <PlusIcon />
              Create outfit
            </Button>
          </>
        }
      />

      {!outfitsQuery.error ? (
        <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="outfit-search">Search</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="outfit-search"
                className="pl-8"
                placeholder="Search outfits by name…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Occasion</Label>
            <Select
              value={occasionId ?? ""}
              onValueChange={(value) => setOccasionId(value || null)}
            >
              <SelectTrigger className="w-full">
                <span className="flex flex-1 truncate text-left">
                  {selectedOccasionName ?? "All"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                {lookups.occasions.map((occasion) => (
                  <SelectItem key={occasion.id} value={occasion.id}>
                    {occasion.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Season</Label>
            <Select
              value={seasonId ?? ""}
              onValueChange={(value) => setSeasonId(value || null)}
            >
              <SelectTrigger className="w-full">
                <span className="flex flex-1 truncate text-left">
                  {selectedSeasonName ?? "All"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                {lookups.seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id}>
                    {season.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Rating</Label>
            <Select
              value={minRating}
              onValueChange={(value) => setMinRating((value || "any") as MinRatingFilter)}
            >
              <SelectTrigger className="w-full">
                <span className="flex flex-1 truncate text-left">
                  {MIN_RATING_LABELS[minRating]}
                </span>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MIN_RATING_LABELS) as MinRatingFilter[]).map(
                  (value) => (
                    <SelectItem key={value} value={value}>
                      {MIN_RATING_LABELS[value]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Score</Label>
            <Select
              value={scoreRange}
              onValueChange={(value) =>
                setScoreRange((value || "any") as ScoreRangeFilter)
              }
            >
              <SelectTrigger className="w-full">
                <span className="flex flex-1 truncate text-left">
                  {SCORE_RANGE_LABELS[scoreRange]}
                </span>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SCORE_RANGE_LABELS) as ScoreRangeFilter[]).map(
                  (value) => (
                    <SelectItem key={value} value={value}>
                      {SCORE_RANGE_LABELS[value]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
            <Button
              type="button"
              variant={favoritesOnly ? "default" : "outline"}
              size="sm"
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly((current) => !current)}
            >
              <HeartIcon
                className={favoritesOnly ? "fill-current" : undefined}
              />
              Favorites only
            </Button>
            {hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
            {scoresQuery.isPending ? (
              <span className="text-xs text-muted-foreground">
                Computing scores…
              </span>
            ) : null}
            {scoresQuery.error ? (
              <span className="text-xs text-destructive">
                Scores unavailable: {scoresQuery.error.message}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {outfitsQuery.error ? (
        <InventoryErrorState
          message={outfitsQuery.error.message}
          onRetry={handleRetry}
          isRetrying={outfitsQuery.isFetching}
        />
      ) : null}

      {!outfitsQuery.error && isInitialLoading ? <OutfitsGridSkeleton /> : null}

      {!outfitsQuery.error && !isInitialLoading && outfits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <LayersIcon className="mb-4 size-10 text-muted-foreground/70" />
          <h2 className="text-lg font-medium">No outfits yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Create your first outfit by picking items from each slot in your
            wardrobe.
          </p>
          <Button className="mt-6" render={<Link href="/outfits/new" />}>
            <PlusIcon />
            Create outfit
          </Button>
        </div>
      ) : null}

      {!outfitsQuery.error &&
      !isInitialLoading &&
      outfits.length > 0 &&
      filteredOutfits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <SearchXIcon className="mb-4 size-10 text-muted-foreground/70" />
          <h2 className="text-lg font-medium">No outfits match your filters</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Try adjusting the search or clearing filters.
          </p>
          <Button className="mt-6" variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : null}

      {!outfitsQuery.error && !isInitialLoading && filteredOutfits.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredOutfits.map((outfit) => (
            <OutfitCard
              key={outfit.id}
              outfit={outfit}
              score={scores[outfit.id] ?? null}
              onDelete={setOutfitToDelete}
              onDuplicate={handleDuplicate}
              onWear={setOutfitToWear}
              onToggleFavorite={handleToggleFavorite}
              isDuplicating={duplicatingId === outfit.id}
            />
          ))}
        </div>
      ) : null}

      <DeleteOutfitDialog
        outfit={outfitToDelete}
        open={outfitToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOutfitToDelete(null);
          }
        }}
      />

      <WearOutfitDialog
        outfit={wearDetailQuery.data ?? null}
        open={outfitToWear !== null && Boolean(wearDetailQuery.data)}
        onOpenChange={(open) => {
          if (!open) {
            setOutfitToWear(null);
          }
        }}
      />
    </div>
  );
}
