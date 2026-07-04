import type { Enums } from "@/types/database";

export type ItemStatus = Enums<"item_status">;
export type OwnershipType = Enums<"ownership_type">;
export type FitType = Enums<"fit_type">;
export type FormalityEnum = Enums<"formality_enum">;
export type UsageFrequency = Enums<"usage_frequency">;

export type LookupOption = {
  id: string;
  name: string;
};

export type SubcategoryOption = LookupOption & {
  category_id: string | null;
};

export type WardrobeLookups = {
  categories: LookupOption[];
  subcategories: SubcategoryOption[];
  brands: LookupOption[];
  colors: LookupOption[];
};

export type WardrobeItemRow = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  subcategory_id: string | null;
  brand_id: string | null;
  primary_color_id: string | null;
  status: ItemStatus | null;
  ownership: OwnershipType | null;
  fit: FitType | null;
  formality: FormalityEnum | null;
  rating: number | null;
  usage: UsageFrequency | null;
  notes: string | null;
  created_at: string | null;
  category: LookupOption | null;
  subcategory: LookupOption | null;
  brand: LookupOption | null;
  primary_color: LookupOption | null;
};

export type InventorySortField = "rating" | "name" | "category" | "created_at";

export type InventorySort = {
  field: InventorySortField;
  ascending?: boolean;
};

export type InventoryFilters = {
  search?: string;
  categoryId?: string;
  status?: ItemStatus;
  sort?: InventorySort;
};

export type CategoryCount = LookupOption & {
  count: number;
};

export type CategoryCountsResult = {
  total: number;
  uncategorized: number;
  categories: CategoryCount[];
};

export type CreateWardrobeItemInput = {
  code: string;
  name: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  brand_id?: string | null;
  primary_color_id?: string | null;
  status?: ItemStatus | null;
  ownership?: OwnershipType | null;
  fit?: FitType | null;
  formality?: FormalityEnum | null;
  rating?: number | null;
  usage?: UsageFrequency | null;
  notes?: string | null;
};

export type UpdateWardrobeItemInput = CreateWardrobeItemInput & {
  id: string;
};

export const ITEM_STATUSES: ItemStatus[] = ["active", "retired", "returned"];
export const OWNERSHIP_TYPES: OwnershipType[] = [
  "owned",
  "wishlist",
  "considering",
];
export const FIT_TYPES: FitType[] = [
  "slim",
  "regular",
  "relaxed",
  "oversized",
  "unknown",
];
export const FORMALITY_LEVELS: FormalityEnum[] = [
  "casual",
  "smart_casual",
  "business_casual",
  "business_formal",
  "formal",
];
export const USAGE_FREQUENCIES: UsageFrequency[] = [
  "rare",
  "occasional",
  "regular",
  "frequent",
  "hero",
];

export const INVENTORY_SORT_OPTIONS: {
  field: InventorySortField;
  label: string;
  defaultAscending: boolean;
}[] = [
  { field: "created_at", label: "Date added", defaultAscending: false },
  { field: "name", label: "Name", defaultAscending: true },
  { field: "rating", label: "Rating", defaultAscending: false },
  { field: "category", label: "Category", defaultAscending: true },
];

export const DEFAULT_INVENTORY_SORT: InventorySort = {
  field: "created_at",
  ascending: false,
};

export const UNCATEGORIZED_CATEGORY_ID = "__uncategorized__";

export function formatEnumLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
