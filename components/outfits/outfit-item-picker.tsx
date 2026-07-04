"use client";

import { useEffect, useState } from "react";
import { ImageIcon, SearchIcon } from "lucide-react";

import { ItemImage } from "@/components/inventory/item-image";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOutfitPickerItems } from "@/lib/wardrobe/hooks";
import { cn } from "@/lib/utils";
import {
  OUTFIT_SLOT_DEFINITIONS,
  type OutfitPickerItem,
  type OutfitSlot,
} from "@/types/wardrobe";

type OutfitItemPickerProps = {
  slot: OutfitSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItemId?: string | null;
  onSelect: (item: OutfitPickerItem) => void;
};

function PickerItemButton({
  item,
  selected,
  onSelect,
}: {
  item: OutfitPickerItem;
  selected: boolean;
  onSelect: (item: OutfitPickerItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border text-left transition-colors hover:bg-muted/40",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border",
      )}
    >
      <div className="relative aspect-square bg-muted/30">
        {item.primary_image_url ? (
          <ItemImage
            src={item.primary_image_url}
            alt={item.name}
            containerClassName="absolute inset-0 size-full"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-6 opacity-60" />
          </div>
        )}
      </div>
      <div className="space-y-0.5 p-2.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{item.name}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {[item.code, item.brand?.name].filter(Boolean).join(" · ")}
        </p>
      </div>
    </button>
  );
}

export function OutfitItemPicker({
  slot,
  open,
  onOpenChange,
  selectedItemId,
  onSelect,
}: OutfitItemPickerProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, searchInput]);

  const slotDefinition = OUTFIT_SLOT_DEFINITIONS.find(
    (definition) => definition.slot === slot,
  );
  const pickerQuery = useOutfitPickerItems(slot ?? "top", debouncedSearch);
  const items = pickerQuery.data ?? [];

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSearchInput("");
      setDebouncedSearch("");
    }
    onOpenChange(next);
  }

  function handleSelect(item: OutfitPickerItem) {
    onSelect(item);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {slotDefinition ? `Choose ${slotDefinition.label}` : "Choose item"}
          </DialogTitle>
          <DialogDescription>
            Search active wardrobe items filtered for this slot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name or code…"
              className="pl-9"
              autoFocus
            />
          </div>

          {pickerQuery.error ? (
            <InventoryErrorState
              message={pickerQuery.error.message}
              onRetry={() => void pickerQuery.refetch()}
              isRetrying={pickerQuery.isFetching}
            />
          ) : null}

          {!pickerQuery.error && pickerQuery.isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[3/4] rounded-lg" />
              ))}
            </div>
          ) : null}

          {!pickerQuery.error && !pickerQuery.isPending && items.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <p className="text-sm font-medium">No matching items</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another search or add active items in this category.
              </p>
            </div>
          ) : null}

          {!pickerQuery.error && !pickerQuery.isPending && items.length > 0 ? (
            <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
              {items.map((item) => (
                <PickerItemButton
                  key={item.id}
                  item={item}
                  selected={item.id === selectedItemId}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t px-6 py-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
