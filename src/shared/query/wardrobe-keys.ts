import type { InventoryFilters, PurchaseFilters, WearLogFilters } from "@/types/wardrobe";

export type CategoryCountFilters = Omit<InventoryFilters, "categoryId" | "sort">;

export const wardrobeKeys = {
  all: ["wardrobe"] as const,
  summary: () => [...wardrobeKeys.all, "summary"] as const,
  items: (filters: InventoryFilters) =>
    [...wardrobeKeys.all, "items", filters] as const,
  item: (id: string) => [...wardrobeKeys.all, "item", id] as const,
  itemImages: (itemId: string) =>
    [...wardrobeKeys.all, "item-images", itemId] as const,
  itemRelations: (itemId: string) =>
    [...wardrobeKeys.all, "item-relations", itemId] as const,
  itemDetail: (itemId: string) =>
    [...wardrobeKeys.all, "item-detail", itemId] as const,
  categoryCounts: (filters: CategoryCountFilters) =>
    [...wardrobeKeys.all, "category-counts", filters] as const,
  lookups: () => [...wardrobeKeys.all, "lookups"] as const,
  review: () => [...wardrobeKeys.all, "review"] as const,
  bulkEditLookups: () => [...wardrobeKeys.all, "bulk-edit-lookups"] as const,
  dashboard: () => [...wardrobeKeys.all, "dashboard"] as const,
  wearLogs: (filters: WearLogFilters) =>
    [...wardrobeKeys.all, "wear-logs", filters] as const,
  itemWearSummary: (itemId: string) =>
    [...wardrobeKeys.all, "item-wear-summary", itemId] as const,
  occasions: () => [...wardrobeKeys.all, "occasions"] as const,
  purchases: (filters: PurchaseFilters) =>
    [...wardrobeKeys.all, "purchases", filters] as const,
  purchaseCharts: (filters: PurchaseFilters) =>
    [...wardrobeKeys.all, "purchase-charts", filters] as const,
  itemPurchase: (itemId: string) =>
    [...wardrobeKeys.all, "item-purchase", itemId] as const,
  outfits: () => [...wardrobeKeys.all, "outfits"] as const,
  outfit: (id: string) => [...wardrobeKeys.all, "outfit", id] as const,
  outfitEvaluation: (id: string) =>
    [...wardrobeKeys.all, "outfit-evaluation", id] as const,
  outfitLookups: () => [...wardrobeKeys.all, "outfit-lookups"] as const,
  outfitPickerItems: (slot: string, search: string) =>
    [...wardrobeKeys.all, "outfit-picker-items", slot, search] as const,
};
