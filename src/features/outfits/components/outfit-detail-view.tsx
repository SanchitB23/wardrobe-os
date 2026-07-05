"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CopyIcon,
  HeartIcon,
  HistoryIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteOutfitDialog } from "@/features/outfits/components/delete-outfit-dialog";
import { OutfitPreview } from "@/features/outfits/components/outfit-preview";
import { OutfitScorePanel } from "@/features/outfits/components/outfit-score-panel";
import { WearOutfitDialog } from "@/features/outfits/components/wear-outfit-dialog";
import {
  useDuplicateOutfitMutation,
  useOutfit,
  useOutfitWearHistory,
  useToggleOutfitFavoriteMutation,
} from "@/features/outfits/hooks";
import {
  formatOutfitModifiedAt,
  outfitDetailToSlotSelection,
} from "@/features/outfits/services/outfits.service";
import { RatingBadge } from "@/shared/ui";
import { type OutfitDetail } from "@/features/outfits/types";

type OutfitDetailViewProps = {
  outfitId: string;
};

function OutfitDetailSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

function formatWearDate(date: string | null): string {
  if (!date) {
    return "—";
  }

  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function OutfitWearHistory({ outfitId }: { outfitId: string }) {
  const historyQuery = useOutfitWearHistory(outfitId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Wear history</CardTitle>
        </div>
        <CardDescription>Logged wears of this outfit.</CardDescription>
      </CardHeader>
      <CardContent>
        {historyQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        ) : null}

        {historyQuery.error ? (
          <div className="space-y-2 text-sm">
            <p className="text-destructive" role="alert">
              {historyQuery.error.message}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void historyQuery.refetch()}
              disabled={historyQuery.isFetching}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {historyQuery.data ? (
          historyQuery.data.timesWorn === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Never worn yet — log a wear with the “Wear outfit” button.
            </p>
          ) : (
            <div className="space-y-4">
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Times worn</dt>
                  <dd className="font-medium tabular-nums">
                    {historyQuery.data.timesWorn}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last worn</dt>
                  <dd className="font-medium">
                    {formatWearDate(historyQuery.data.lastWornOn)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Avg comfort</dt>
                  <dd className="font-medium tabular-nums">
                    {historyQuery.data.averageComfort !== null
                      ? `${historyQuery.data.averageComfort}/10`
                      : "—"}
                  </dd>
                </div>
              </dl>
              <ul className="space-y-1.5 text-sm">
                {historyQuery.data.events.slice(0, 5).map((event) => (
                  <li
                    key={event.worn_on}
                    className="flex items-center justify-between rounded-md border px-3 py-1.5"
                  >
                    <span>{formatWearDate(event.worn_on)}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {event.comfort_rating !== null
                        ? `Comfort ${event.comfort_rating}/10`
                        : "No comfort rating"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

function OutfitMetadata({ outfit }: { outfit: OutfitDetail }) {
  const itemCount = outfit.items.filter((entry) => entry.item).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>Metadata for this outfit.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Occasion</dt>
            <dd className="font-medium">{outfit.occasion?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Season</dt>
            <dd className="font-medium">{outfit.season?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Rating</dt>
            <dd className="font-medium">
              {outfit.rating !== null ? (
                <RatingBadge value={outfit.rating} />
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Items</dt>
            <dd className="font-medium tabular-nums">{itemCount}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-medium">{formatOutfitModifiedAt(outfit)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-wrap font-medium">
              {outfit.notes?.trim() ? outfit.notes : "—"}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export function OutfitDetailView({ outfitId }: OutfitDetailViewProps) {
  const router = useRouter();
  const outfitQuery = useOutfit(outfitId);
  const duplicateMutation = useDuplicateOutfitMutation();
  const favoriteMutation = useToggleOutfitFavoriteMutation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [wearDialogOpen, setWearDialogOpen] = useState(false);

  const outfit = outfitQuery.data ?? null;
  const wearableItemCount =
    outfit?.items.filter((entry) => entry.item).length ?? 0;

  async function handleDuplicate() {
    try {
      const duplicated = await duplicateMutation.mutateAsync(outfitId);
      if (duplicated) {
        router.push(`/outfits/${duplicated.id}`);
      }
    } catch {
      // Mutation onError shows toast.
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              render={<Link href="/outfits" />}
            >
              <ArrowLeftIcon />
              Outfits
            </Button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {outfit?.name ?? "Outfit"}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Review the items and metadata in this saved outfit.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            aria-pressed={outfit?.favorite ?? false}
            onClick={() =>
              outfit &&
              favoriteMutation.mutate({ id: outfit.id, favorite: !outfit.favorite })
            }
            disabled={!outfit || favoriteMutation.isPending}
          >
            <HeartIcon
              className={
                outfit?.favorite ? "fill-rose-500 text-rose-500" : undefined
              }
            />
            {outfit?.favorite ? "Favorited" : "Favorite"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setWearDialogOpen(true)}
            disabled={!outfit || wearableItemCount === 0}
          >
            <CalendarDaysIcon />
            Wear outfit
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleDuplicate()}
            disabled={!outfit || duplicateMutation.isPending}
          >
            <CopyIcon />
            {duplicateMutation.isPending ? "Duplicating…" : "Duplicate"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!outfit}
          >
            <Trash2Icon />
            Delete
          </Button>
          <Button render={<Link href={`/outfits/${outfitId}/edit`} />}>
            <PencilIcon />
            Edit outfit
          </Button>
        </div>
      </header>

      {outfitQuery.isPending ? <OutfitDetailSkeleton /> : null}

      {outfitQuery.error ? (
        <InventoryErrorState
          message={outfitQuery.error.message}
          onRetry={() => void outfitQuery.refetch()}
          isRetrying={outfitQuery.isFetching}
        />
      ) : null}

      {!outfitQuery.isPending && !outfitQuery.error && !outfit ? (
        <InventoryErrorState
          message="Outfit not found."
          onRetry={() => void outfitQuery.refetch()}
          isRetrying={outfitQuery.isFetching}
        />
      ) : null}

      {outfit ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <OutfitPreview selection={outfitDetailToSlotSelection(outfit)} />
            <div className="space-y-4 xl:sticky xl:top-6">
              <OutfitMetadata outfit={outfit} />
              <OutfitWearHistory outfitId={outfit.id} />
            </div>
          </div>
          <OutfitScorePanel outfit={outfit} />
        </>
      ) : null}

      <DeleteOutfitDialog
        outfit={
          outfit ? { ...outfit, itemCount: wearableItemCount } : null
        }
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={() => router.push("/outfits")}
      />

      <WearOutfitDialog
        outfit={outfit}
        open={wearDialogOpen}
        onOpenChange={setWearDialogOpen}
      />
    </div>
  );
}
