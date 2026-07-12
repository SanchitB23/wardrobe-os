"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";

import { PageHeader } from "@/features/layout";
import { useOccasions, useCreateAdHocWearLogMutation } from "@/features/wear-logs/hooks";
import { formatWearLogDateInput } from "@/features/wear-logs/services/wear-logs.service";
import { useWardrobeItems } from "@/features/inventory/hooks";
import { ItemImage } from "@/features/inventory/components/item-image";
import { ItemPreviewDialog } from "@/features/inventory/components/item-preview-dialog";
import {
  WearLogItemPicker,
  type WearLogPickerItem,
} from "@/features/wear-logs/components/wear-log-item-picker";
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
import { Textarea } from "@/components/ui/textarea";
import {
  OUTFIT_SLOT_DEFINITIONS,
  categoryMatchesOutfitSlot,
} from "@/domain/outfit/slot-matching";
import { buildWearLogSlotEntries } from "@/domain/wear-logs";
import type { OutfitSlot } from "@/types/wardrobe";

const QUICK_SLOTS: OutfitSlot[] = ["top", "bottom", "footwear", "accessory"];
const MULTI_SLOTS: OutfitSlot[] = ["top", "accessory"];

type SlotPick = Partial<Record<OutfitSlot, string[]>>;

function SlotThumb({
  item,
  onPreview,
  onRemove,
}: {
  item: WearLogPickerItem;
  onPreview: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative size-20 shrink-0 overflow-hidden rounded-md border bg-muted/30">
      <button
        type="button"
        aria-label={`Preview ${item.name}`}
        className="absolute inset-0"
        onClick={onPreview}
      >
        {item.primary_image_url ? (
          <ItemImage
            src={item.primary_image_url}
            alt={item.name}
            containerClassName="absolute inset-0 size-full"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-5 opacity-60" />
          </div>
        )}
      </button>
      <button
        type="button"
        aria-label={`Remove ${item.name}`}
        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-foreground"
        onClick={onRemove}
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}

export function QuickWearLogView({
  initialItemIds = [],
}: {
  initialItemIds?: string[];
}) {
  const router = useRouter();
  const [wornOn, setWornOn] = useState(formatWearLogDateInput());
  const [occasionId, setOccasionId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [slotPicks, setSlotPicks] = useState<SlotPick>({});
  const [extraIds, setExtraIds] = useState<string[]>(initialItemIds);
  const [error, setError] = useState<string | null>(null);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<OutfitSlot | null>(null);

  const itemsQuery = useWardrobeItems({ status: "active" });
  const occasionsQuery = useOccasions();
  const createMutation = useCreateAdHocWearLogMutation();

  const items = useMemo(
    () => itemsQuery.data ?? [],
    [itemsQuery.data],
  );
  const occasions = occasionsQuery.data ?? [];

  const itemById = useMemo(() => {
    const map = new Map<string, (typeof items)[number]>();
    for (const item of items) {
      map.set(item.id, item);
    }
    return map;
  }, [items]);

  const itemsBySlot = useMemo(() => {
    const map = new Map<OutfitSlot, typeof items>();
    for (const slot of QUICK_SLOTS) {
      map.set(
        slot,
        items.filter((item) =>
          categoryMatchesOutfitSlot(item.category?.name ?? null, slot),
        ),
      );
    }
    return map;
  }, [items]);

  const pickedAnywhere = useMemo(
    () => new Set(QUICK_SLOTS.flatMap((s) => slotPicks[s] ?? [])),
    [slotPicks],
  );

  function handleToggle(slot: OutfitSlot, item: WearLogPickerItem) {
    setSlotPicks((prev) => {
      const current = prev[slot] ?? [];
      if (MULTI_SLOTS.includes(slot)) {
        return {
          ...prev,
          [slot]: current.includes(item.id)
            ? current.filter((x) => x !== item.id)
            : [...current, item.id],
        };
      }
      return { ...prev, [slot]: [item.id] };
    });
  }

  function removeFromSlot(slot: OutfitSlot, id: string) {
    setSlotPicks((prev) => ({
      ...prev,
      [slot]: (prev[slot] ?? []).filter((x) => x !== id),
    }));
  }

  // Items shown in the picker for the active slot: matching that slot and not
  // already picked in a different slot (its own picks stay visible/selected).
  const pickerItems = useMemo(() => {
    if (!activeSlot) {
      return [];
    }
    const ownPicks = new Set(slotPicks[activeSlot] ?? []);
    return (itemsBySlot.get(activeSlot) ?? []).filter(
      (item) => ownPicks.has(item.id) || !pickedAnywhere.has(item.id),
    );
  }, [activeSlot, itemsBySlot, pickedAnywhere, slotPicks]);

  async function handleSave() {
    setError(null);
    const selected = buildWearLogSlotEntries(slotPicks, QUICK_SLOTS, extraIds);
    if (selected.length === 0) {
      setError("Select at least one item.");
      return;
    }
    if (!wornOn) {
      setError("Date is required.");
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        wornOn,
        items: selected,
        occasionId: occasionId || null,
        notes: notes.trim() || null,
      });
      router.push(`/wear-logs/${result.wearLog.id}`);
    } catch {
      // toast handled by mutation
    }
  }

  const activeSlotDef = activeSlot
    ? OUTFIT_SLOT_DEFINITIONS.find((d) => d.slot === activeSlot)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Quick Log Wear"
        badge={<Badge variant="secondary">Ad-hoc</Badge>}
        description="Log what you wore without creating a saved outfit. Outfits stay curated."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">When & context</CardTitle>
          <CardDescription>Date, occasion, and optional notes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wear-date">Date</Label>
            <Input
              id="wear-date"
              type="date"
              value={wornOn}
              onChange={(e) => setWornOn(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Occasion</Label>
            <Select
              value={occasionId || "__none__"}
              onValueChange={(v) =>
                setOccasionId(!v || v === "__none__" ? "" : v)
              }
            >
              <SelectTrigger className="w-full">
                <span className="flex flex-1 text-left">
                  {occasions.find((o) => o.id === occasionId)?.name ?? "None"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {occasions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="wear-notes">Notes</Label>
            <Textarea
              id="wear-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Items</CardTitle>
          <CardDescription>
            Pick Top, Bottom, Footwear, and Accessories. No outfit is created.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {QUICK_SLOTS.map((slot) => {
            const def = OUTFIT_SLOT_DEFINITIONS.find((d) => d.slot === slot);
            const label = def?.label ?? slot;
            const picked = slotPicks[slot] ?? [];
            const isMulti = MULTI_SLOTS.includes(slot);
            const pickedItems = picked
              .map((id) => itemById.get(id))
              .filter((item): item is (typeof items)[number] => Boolean(item));

            return (
              <div key={slot} className="rounded-lg border p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{label}</p>
                    {isMulti ? (
                      <Badge variant="outline">Multiple</Badge>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveSlot(slot)}
                  >
                    {isMulti ? (
                      <>
                        <PlusIcon />
                        Add
                      </>
                    ) : pickedItems.length > 0 ? (
                      "Change"
                    ) : (
                      "Choose"
                    )}
                  </Button>
                </div>

                {pickedItems.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pickedItems.map((item) => (
                      <SlotThumb
                        key={item.id}
                        item={item}
                        onPreview={() => setPreviewItemId(item.id)}
                        onRemove={() => removeFromSlot(slot, item.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No item selected
                  </p>
                )}
              </div>
            );
          })}

          {extraIds.length > 0 ? (
            <div className="space-y-2 rounded-lg border p-3 sm:p-4">
              <p className="font-medium">Also selected</p>
              <div className="flex flex-wrap gap-2">
                {extraIds.map((id) => {
                  const item = itemById.get(id);
                  if (!item) {
                    return null;
                  }
                  return (
                    <SlotThumb
                      key={id}
                      item={item}
                      onPreview={() => setPreviewItemId(id)}
                      onRemove={() =>
                        setExtraIds((prev) => prev.filter((x) => x !== id))
                      }
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => void handleSave()}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : null}
          Save wear log
        </Button>
        <Button variant="outline" onClick={() => router.push("/wear-logs")}>
          Cancel
        </Button>
      </div>

      <WearLogItemPicker
        open={activeSlot !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveSlot(null);
          }
        }}
        slotLabel={(activeSlotDef?.label ?? activeSlot ?? "item").toString()}
        items={activeSlot ? pickerItems : []}
        multiple={activeSlot ? MULTI_SLOTS.includes(activeSlot) : false}
        selectedItemIds={activeSlot ? (slotPicks[activeSlot] ?? []) : []}
        onToggle={(item) => {
          if (activeSlot) {
            handleToggle(activeSlot, item);
          }
        }}
      />

      <ItemPreviewDialog
        itemId={previewItemId}
        open={previewItemId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewItemId(null);
            void itemsQuery.refetch();
          }
        }}
      />
    </div>
  );
}
