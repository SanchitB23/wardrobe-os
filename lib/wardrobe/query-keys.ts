import type { InventoryFilters } from "@/types/wardrobe";

export type CategoryCountFilters = Omit<InventoryFilters, "categoryId" | "sort">;

export const wardrobeKeys = {
  all: ["wardrobe"] as const,
  summary: () => [...wardrobeKeys.all, "summary"] as const,
  items: (filters: InventoryFilters) =>
    [...wardrobeKeys.all, "items", filters] as const,
  item: (id: string) => [...wardrobeKeys.all, "item", id] as const,
  itemImages: (itemId: string) =>
    [...wardrobeKeys.all, "item-images", itemId] as const,
  categoryCounts: (filters: CategoryCountFilters) =>
    [...wardrobeKeys.all, "category-counts", filters] as const,
  lookups: () => [...wardrobeKeys.all, "lookups"] as const,
};
