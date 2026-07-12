"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, Loader2Icon, XIcon } from "lucide-react";

import { PageHeader } from "@/features/layout";
import { useOccasions, useCreateAdHocWearLogMutation } from "@/features/wear-logs/hooks";
import { formatWearLogDateInput } from "@/features/wear-logs/services/wear-logs.service";
import { useWardrobeItems } from "@/features/inventory/hooks";
import { ItemPreviewDialog } from "@/features/inventory/components/item-preview-dialog";
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

  const itemsQuery = useWardrobeItems({ status: "active" });
  const occasionsQuery = useOccasions();
  const createMutation = useCreateAdHocWearLogMutation();

  const items = useMemo(
    () => itemsQuery.data ?? [],
    [itemsQuery.data],
  );
  const occasions = occasionsQuery.data ?? [];

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
        <CardContent className="space-y-4">
          {QUICK_SLOTS.map((slot) => {
            const def = OUTFIT_SLOT_DEFINITIONS.find((d) => d.slot === slot);
            const options = itemsBySlot.get(slot) ?? [];
            const picked = slotPicks[slot] ?? [];
            const isMulti = MULTI_SLOTS.includes(slot);

            if (isMulti) {
              const available = options.filter((i) => !pickedAnywhere.has(i.id));
              return (
                <div key={slot} className="space-y-1.5">
                  <Label>{def?.label ?? slot}</Label>
                  <Select
                    value="__none__"
                    onValueChange={(v) => {
                      if (!v || v === "__none__") return;
                      setSlotPicks((prev) => ({
                        ...prev,
                        [slot]: [...(prev[slot] ?? []), v],
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <span className="flex flex-1 text-left text-muted-foreground">
                        Add {(def?.label ?? slot).toLowerCase()}…
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Add…</SelectItem>
                      {available.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {picked.length > 0 ? (
                    <ul className="flex flex-wrap gap-2 pt-1">
                      {picked.map((id) => {
                        const item = options.find((i) => i.id === id);
                        return (
                          <li key={id}>
                            <Badge variant="outline" className="gap-1.5">
                              {item?.name ?? id.slice(0, 8)}
                              <button
                                type="button"
                                aria-label={`Preview ${item?.name ?? "item"}`}
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => setPreviewItemId(id)}
                              >
                                <EyeIcon className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove ${item?.name ?? "item"}`}
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setSlotPicks((prev) => ({
                                    ...prev,
                                    [slot]: (prev[slot] ?? []).filter(
                                      (x) => x !== id,
                                    ),
                                  }))
                                }
                              >
                                <XIcon className="size-3.5" />
                              </button>
                            </Badge>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            }

            const value = picked[0] ?? "";
            return (
              <div key={slot} className="space-y-1.5">
                <Label>{def?.label ?? slot}</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={value || "__none__"}
                    onValueChange={(v) =>
                      setSlotPicks((prev) => ({
                        ...prev,
                        [slot]: !v || v === "__none__" ? [] : [v],
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <span className="flex flex-1 text-left">
                        {options.find((i) => i.id === value)?.name ?? "None"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {options
                        .filter((item) => item.id === value || !pickedAnywhere.has(item.id))
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {value ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Preview item"
                      onClick={() => setPreviewItemId(value)}
                    >
                      <EyeIcon className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}

          {extraIds.length > 0 ? (
            <div className="space-y-2">
              <Label>Also selected</Label>
              <ul className="flex flex-wrap gap-2">
                {extraIds.map((id) => {
                  const item = items.find((i) => i.id === id);
                  return (
                    <li key={id}>
                      <Badge variant="outline" className="gap-1">
                        {item?.name ?? id.slice(0, 8)}
                        <button
                          type="button"
                          className="ml-1 text-muted-foreground"
                          onClick={() =>
                            setExtraIds((prev) => prev.filter((x) => x !== id))
                          }
                        >
                          ×
                        </button>
                      </Badge>
                    </li>
                  );
                })}
              </ul>
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
