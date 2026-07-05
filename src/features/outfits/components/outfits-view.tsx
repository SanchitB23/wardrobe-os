"use client";

import Link from "next/link";
import { useState } from "react";
import {
  LayersIcon,
  PlusIcon,
  RefreshCwIcon,
  ShirtIcon,
} from "lucide-react";

import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteOutfitDialog } from "@/features/outfits/components/delete-outfit-dialog";
import { OutfitCard } from "@/features/outfits/components/outfit-card";
import { WearOutfitDialog } from "@/features/outfits/components/wear-outfit-dialog";
import {
  useDuplicateOutfitMutation,
  useOutfit,
  useOutfits,
} from "@/features/outfits/hooks";
import type { OutfitListRow } from "@/features/outfits/types";

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
  const duplicateMutation = useDuplicateOutfitMutation();
  const [outfitToDelete, setOutfitToDelete] = useState<OutfitListRow | null>(
    null,
  );
  const [outfitToWear, setOutfitToWear] = useState<OutfitListRow | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const wearDetailQuery = useOutfit(outfitToWear?.id ?? "");

  const outfits = outfitsQuery.data ?? [];
  const isInitialLoading = outfitsQuery.isPending && !outfitsQuery.data;
  const isRefetching = outfitsQuery.isFetching && !outfitsQuery.isPending;

  function handleRetry() {
    void outfitsQuery.refetch();
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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Outfits</h1>
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
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Build complete looks from your wardrobe — assign tops, bottoms,
            footwear, and optional layers.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/inventory" />}>
            <ShirtIcon />
            Inventory
          </Button>
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
        </div>
      </header>

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

      {!outfitsQuery.error && !isInitialLoading && outfits.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {outfits.map((outfit) => (
            <OutfitCard
              key={outfit.id}
              outfit={outfit}
              onDelete={setOutfitToDelete}
              onDuplicate={handleDuplicate}
              onWear={setOutfitToWear}
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
    </main>
  );
}
