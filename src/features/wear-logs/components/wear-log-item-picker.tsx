"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ImageIcon, SearchIcon } from "lucide-react";

import { ItemImage } from "@/features/inventory/components/item-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type WearLogPickerItem = {
  id: string;
  name: string;
  code: string;
  primary_image_url: string | null;
  brand: { name: string } | null;
};

type WearLogItemPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotLabel: string;
  /** Active items already filtered to this slot and de-duplicated against other slots. */
  items: WearLogPickerItem[];
  /** When true, selecting toggles membership and the modal stays open until Done. */
  multiple: boolean;
  selectedItemIds: string[];
  onToggle: (item: WearLogPickerItem) => void;
};

function PickerItemButton({
  item,
  selected,
  showCheck,
  onSelect,
}: {
  item: WearLogPickerItem;
  selected: boolean;
  showCheck: boolean;
  onSelect: (item: WearLogPickerItem) => void;
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
        {showCheck && selected ? (
          <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <CheckIcon className="size-4" />
          </span>
        ) : null}
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

export function WearLogItemPicker({
  open,
  onOpenChange,
  slotLabel,
  items,
  multiple,
  selectedItemIds,
  onToggle,
}: WearLogItemPickerProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, searchInput]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSearchInput("");
      setDebouncedSearch("");
    }
    onOpenChange(next);
  }

  function handleSelect(item: WearLogPickerItem) {
    onToggle(item);
    if (!multiple) {
      handleOpenChange(false);
    }
  }

  const selectedSet = new Set(selectedItemIds);
  const visibleItems = debouncedSearch
    ? items.filter((item) =>
        [item.name, item.code, item.brand?.name]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(debouncedSearch)),
      )
    : items;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {multiple ? `Add ${slotLabel}` : `Choose ${slotLabel}`}
          </DialogTitle>
          <DialogDescription>
            {multiple
              ? "Tap items to add or remove them. Choose as many as you wore."
              : "Search active wardrobe items filtered for this slot."}
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

          {visibleItems.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <p className="text-sm font-medium">No matching items</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another search or add active items in this category.
              </p>
            </div>
          ) : (
            <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
              {visibleItems.map((item) => (
                <PickerItemButton
                  key={item.id}
                  item={item}
                  selected={selectedSet.has(item.id)}
                  showCheck={multiple}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t px-6 py-3">
          <Button
            variant={multiple ? "default" : "outline"}
            onClick={() => handleOpenChange(false)}
          >
            {multiple ? "Done" : "Cancel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
