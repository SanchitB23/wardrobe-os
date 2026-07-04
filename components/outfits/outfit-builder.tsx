"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  ImageIcon,
  SaveIcon,
  ShirtIcon,
  XIcon,
} from "lucide-react";

import { OutfitItemPicker } from "@/components/outfits/outfit-item-picker";
import { OutfitPreview } from "@/components/outfits/outfit-preview";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { ItemImage } from "@/components/inventory/item-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateOutfitMutation,
  useOutfit,
  useOutfitLookups,
  useUpdateOutfitMutation,
} from "@/lib/wardrobe/hooks";
import { outfitDetailToSlotSelection, outfitSeasonToSelectId } from "@/lib/wardrobe/outfits";
import {
  OUTFIT_SLOT_DEFINITIONS,
  type OutfitPickerItem,
  type OutfitSlot,
  type OutfitSlotSelection,
} from "@/types/wardrobe";

type OutfitBuilderProps = {
  outfitId?: string;
};

function slotSelectionToItems(selection: OutfitSlotSelection) {
  return OUTFIT_SLOT_DEFINITIONS.flatMap((definition) => {
    const item = selection[definition.slot];
    if (!item) {
      return [];
    }

    return [{ item_id: item.id, slot: definition.slot }];
  });
}

function OutfitBuilderSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
      <Skeleton className="h-[520px] w-full" />
    </div>
  );
}

type OutfitBuilderFormProps = {
  outfitId?: string;
  initialName: string;
  initialOccasionId: string | null;
  initialSeasonId: string | null;
  initialRating: string;
  initialSelection: OutfitSlotSelection;
};

function OutfitBuilderForm({
  outfitId,
  initialName,
  initialOccasionId,
  initialSeasonId,
  initialRating,
  initialSelection,
}: OutfitBuilderFormProps) {
  const router = useRouter();
  const isEdit = Boolean(outfitId);

  const [name, setName] = useState(initialName);
  const [occasionId, setOccasionId] = useState<string | null>(initialOccasionId);
  const [seasonId, setSeasonId] = useState<string | null>(initialSeasonId);
  const [rating, setRating] = useState(initialRating);
  const [selection, setSelection] = useState<OutfitSlotSelection>(initialSelection);
  const [activeSlot, setActiveSlot] = useState<OutfitSlot | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const lookupsQuery = useOutfitLookups();
  const createMutation = useCreateOutfitMutation();
  const updateMutation = useUpdateOutfitMutation();

  const lookups = lookupsQuery.data ?? {
    occasions: [],
    seasons: [],
    categories: [],
  };

  const selectedOccasionName =
    lookups.occasions.find((occasion) => occasion.id === occasionId)?.name ??
    null;
  const selectedSeasonName =
    lookups.seasons.find((season) => season.id === seasonId)?.name ?? null;

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const itemCount = useMemo(
    () =>
      OUTFIT_SLOT_DEFINITIONS.filter((definition) => selection[definition.slot])
        .length,
    [selection],
  );

  function openPicker(slot: OutfitSlot) {
    setActiveSlot(slot);
  }

  function handleSelectItem(item: OutfitPickerItem) {
    if (!activeSlot) {
      return;
    }

    setSelection((current) => ({
      ...current,
      [activeSlot]: item,
    }));
  }

  function clearSlot(slot: OutfitSlot) {
    setSelection((current) => ({
      ...current,
      [slot]: null,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError("Outfit name is required.");
      return;
    }

    const missingRequired = OUTFIT_SLOT_DEFINITIONS.filter(
      (definition) => !definition.optional && !selection[definition.slot],
    );

    if (missingRequired.length > 0) {
      setValidationError(
        `Required slots: ${missingRequired.map((definition) => definition.label).join(", ")}.`,
      );
      return;
    }

    const parsedRating = rating.trim() ? Number(rating) : null;
    if (
      parsedRating !== null &&
      (Number.isNaN(parsedRating) || parsedRating < 0 || parsedRating > 10)
    ) {
      setValidationError("Rating must be between 0 and 10.");
      return;
    }

    const payload = {
      name: trimmedName,
      occasion_id: occasionId,
      season_id: seasonId,
      rating: parsedRating,
      items: slotSelectionToItems(selection),
    };

    try {
      if (isEdit && outfitId) {
        await updateMutation.mutateAsync({ ...payload, id: outfitId });
        router.push("/outfits");
        return;
      }

      await createMutation.mutateAsync(payload);
      router.push("/outfits");
    } catch {
      // Mutation onError shows toast.
    }
  }

  return (
    <>
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Outfit details</CardTitle>
                <CardDescription>
                  Name your outfit and set occasion, season, and rating.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="outfit-name">Name</Label>
                  <Input
                    id="outfit-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Weekend casual"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Occasion</Label>
                  <Select
                    value={occasionId ?? ""}
                    onValueChange={(value) => setOccasionId(value || null)}
                  >
                    <SelectTrigger className="w-full">
                      <span
                        className={
                          selectedOccasionName
                            ? "flex flex-1 truncate text-left"
                            : "flex flex-1 truncate text-left text-muted-foreground"
                        }
                      >
                        {selectedOccasionName ?? "None"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
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
                      <span
                        className={
                          selectedSeasonName
                            ? "flex flex-1 truncate text-left"
                            : "flex flex-1 truncate text-left text-muted-foreground"
                        }
                      >
                        {selectedSeasonName ?? "None"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {lookups.seasons.map((season) => (
                        <SelectItem key={season.id} value={season.id}>
                          {season.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="outfit-rating">Rating (0–10)</Label>
                  <Input
                    id="outfit-rating"
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={rating}
                    onChange={(event) => setRating(event.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Items selected</Label>
                  <div className="flex h-9 items-center rounded-md border bg-muted/20 px-3 text-sm tabular-nums">
                    {itemCount}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slots</CardTitle>
                <CardDescription>
                  Pick one item per section. Required slots must be filled before
                  saving.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {OUTFIT_SLOT_DEFINITIONS.map((definition) => {
                  const selectedItem = selection[definition.slot];

                  return (
                    <div
                      key={definition.slot}
                      className="rounded-lg border p-3 sm:p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="relative size-16 shrink-0 overflow-hidden rounded-md border bg-muted/30">
                            {selectedItem?.primary_image_url ? (
                              <ItemImage
                                src={selectedItem.primary_image_url}
                                alt={selectedItem.name}
                                containerClassName="absolute inset-0 size-full"
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center text-muted-foreground">
                                <ImageIcon className="size-4 opacity-60" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{definition.label}</p>
                              {definition.optional ? (
                                <Badge variant="outline">Optional</Badge>
                              ) : (
                                <Badge variant="secondary">Required</Badge>
                              )}
                            </div>
                            {selectedItem ? (
                              <div className="mt-1 min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {selectedItem.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {[
                                    selectedItem.code,
                                    selectedItem.brand?.name,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-1 text-sm text-muted-foreground">
                                No item selected
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openPicker(definition.slot)}
                          >
                            {selectedItem ? "Change" : "Choose"}
                          </Button>
                          {selectedItem ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Clear ${definition.label}`}
                              onClick={() => clearSlot(definition.slot)}
                            >
                              <XIcon />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="xl:sticky xl:top-6">
            <Card>
              <CardHeader>
                <CardTitle>Live preview</CardTitle>
                <CardDescription>
                  Large cards update as you assign items to each slot.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OutfitPreview selection={selection} />
              </CardContent>
            </Card>
          </div>
        </div>

        {validationError ? (
          <p className="text-sm text-destructive" role="alert">
            {validationError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button type="submit" disabled={isSaving}>
            <SaveIcon />
            {isSaving ? "Saving…" : isEdit ? "Save changes" : "Save outfit"}
          </Button>
          <Button
            type="button"
            variant="outline"
            render={<Link href="/outfits" />}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </form>

      <OutfitItemPicker
        slot={activeSlot}
        open={activeSlot !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveSlot(null);
          }
        }}
        selectedItemId={
          activeSlot ? (selection[activeSlot]?.id ?? null) : null
        }
        onSelect={handleSelectItem}
      />
    </>
  );
}

export function OutfitBuilder({ outfitId }: OutfitBuilderProps) {
  const isEdit = Boolean(outfitId);
  const outfitQuery = useOutfit(outfitId ?? "");
  const lookupsQuery = useOutfitLookups();

  const isLoading =
    lookupsQuery.isPending || (isEdit && outfitQuery.isPending);
  const error =
    lookupsQuery.error?.message ??
    (isEdit ? outfitQuery.error?.message : undefined);

  if (isLoading) {
    return <OutfitBuilderSkeleton />;
  }

  if (error) {
    return (
      <InventoryErrorState
        message={error}
        onRetry={() => {
          void lookupsQuery.refetch();
          if (isEdit) {
            void outfitQuery.refetch();
          }
        }}
        isRetrying={lookupsQuery.isFetching || outfitQuery.isFetching}
      />
    );
  }

  if (isEdit && !outfitQuery.data) {
    return (
      <InventoryErrorState
        message="Outfit not found."
        onRetry={() => void outfitQuery.refetch()}
        isRetrying={outfitQuery.isFetching}
      />
    );
  }

  const outfit = outfitQuery.data;
  const formKey = isEdit && outfit ? outfit.id : "new";

  return (
    <OutfitBuilderForm
      key={formKey}
      outfitId={outfitId}
      initialName={outfit?.name ?? ""}
      initialOccasionId={outfit?.occasion_id ?? null}
      initialSeasonId={outfit ? outfitSeasonToSelectId(outfit) : null}
      initialRating={
        outfit?.rating !== null && outfit?.rating !== undefined
          ? String(outfit.rating)
          : ""
      }
      initialSelection={
        outfit ? outfitDetailToSlotSelection(outfit) : {}
      }
    />
  );
}

type OutfitBuilderPageShellProps = {
  title: string;
  description: string;
  outfitId?: string;
};

export function OutfitBuilderPageShell({
  title,
  description,
  outfitId,
}: OutfitBuilderPageShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
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
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/inventory" />}>
            <ShirtIcon />
            Inventory
          </Button>
        </div>
      </header>

      <OutfitBuilder outfitId={outfitId} />
    </main>
  );
}
