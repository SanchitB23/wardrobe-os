"use client";

import { PlusIcon, ShirtIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/shared/ui";

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
    <EmptyState
      icon={ShirtIcon}
      title={hasFilters ? "No items match your filters" : "Your wardrobe is empty"}
      description={
        hasFilters
          ? "Try adjusting search, status, or category filters to see more items."
          : "Add your first piece to start building your inventory catalog."
      }
      actions={
        <>
          <Button onClick={onAddItem}>
            <PlusIcon />
            {hasFilters ? "Add item" : "Add your first item"}
          </Button>
          {hasFilters && onClearFilters && (
            <Button variant="outline" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </>
      }
    />
  );
}
