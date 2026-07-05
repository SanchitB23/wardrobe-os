"use client";

import { PlusIcon, ShirtIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type InventoryEmptyStateProps = {
  hasFilters: boolean;
  onAddItem: () => void;
  onClearFilters?: () => void;
};

export function InventoryEmptyState({
  hasFilters,
  onAddItem,
  onClearFilters,
}: InventoryEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <ShirtIcon className="size-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">
        {hasFilters ? "No items match your filters" : "Your wardrobe is empty"}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasFilters
          ? "Try adjusting search, status, or category filters to see more items."
          : "Add your first piece to start building your inventory catalog."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onAddItem}>
          <PlusIcon />
          {hasFilters ? "Add item" : "Add your first item"}
        </Button>
        {hasFilters && onClearFilters && (
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
