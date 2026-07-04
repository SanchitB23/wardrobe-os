import type { Enums } from "@/types/database";

export type ItemStatus = Enums<"item_status">;
export type OwnershipType = Enums<"ownership_type">;
export type FitType = Enums<"fit_type">;
export type FormalityEnum = Enums<"formality_enum">;
export type UsageFrequency = Enums<"usage_frequency">;
export type ImageType = Enums<"image_type_enum">;

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

export type WardrobeImportLookups = WardrobeLookups & {
  materials: LookupOption[];
  seasons: LookupOption[];
  styles: LookupOption[];
  features: LookupOption[];
  tags: LookupOption[];
  occasions: LookupOption[];
  storage_types: LookupOption[];
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
  primary_image_url: string | null;
};

export type ItemImageRow = {
  id: string;
  item_id: string | null;
  image_url: string;
  image_type: ImageType | null;
  is_primary: boolean | null;
  created_at: string | null;
};

export type InventorySortField = "rating" | "name" | "category" | "created_at";

export type InventorySort = {
  field: InventorySortField;
  ascending?: boolean;
};

export type InventoryFilters = {
  search?: string;
  categoryId?: string;
  subcategoryId?: string;
  brandId?: string;
  primaryColorId?: string;
  status?: ItemStatus;
  usage?: UsageFrequency;
  sort?: InventorySort;
};

export type InventorySummary = {
  totalItems: number;
  activeItems: number;
  heroPieces: number;
  averageRating: number | null;
};

export type DashboardSummary = InventorySummary & {
  favorites: number;
};

export type AnalyticsDistributionItem = {
  id: string | null;
  name: string;
  count: number;
};

export type AnalyticsColorDistributionItem = AnalyticsDistributionItem & {
  hex: string | null;
};

export type AnalyticsEnumDistributionItem = {
  value: string;
  label: string;
  count: number;
};

export type AnalyticsInsightItem = {
  id: string;
  code: string;
  name: string;
  rating: number | null;
  usage: UsageFrequency | null;
  category: string | null;
};

export type WardrobeDashboardAnalytics = {
  summary: DashboardSummary;
  categories: AnalyticsDistributionItem[];
  subcategories: AnalyticsDistributionItem[];
  brands: AnalyticsDistributionItem[];
  colors: AnalyticsColorDistributionItem[];
  usage: AnalyticsEnumDistributionItem[];
  formality: AnalyticsEnumDistributionItem[];
  seasons: AnalyticsDistributionItem[];
  insights: {
    highestRated: AnalyticsInsightItem[];
    lowestRatedActive: AnalyticsInsightItem[];
    rareUsage: AnalyticsInsightItem[];
    highCountCategories: AnalyticsDistributionItem[];
  };
  wearInsights: WearLogAnalytics;
  purchaseInsights: PurchaseAnalytics;
};

export type PurchaseStatus = "active" | "returned" | "pending" | "cancelled";

export type PurchaseRow = {
  id: string;
  item_id: string;
  purchase_date: string;
  price: number;
  source: string | null;
  status: PurchaseStatus | string | null;
  return_reason: string | null;
  created_at: string | null;
};

export type PurchaseListRow = PurchaseRow & {
  item: {
    id: string;
    code: string;
    name: string;
    brand: LookupOption | null;
    category: LookupOption | null;
  } | null;
};

export type CreatePurchaseInput = {
  item_id: string;
  purchase_date: string;
  price: number;
  source?: string | null;
  status?: PurchaseStatus | string | null;
  return_reason?: string | null;
};

export type UpdatePurchaseInput = CreatePurchaseInput & {
  id: string;
};

export type PurchaseFilters = {
  year?: string;
  brandId?: string;
  categoryId?: string;
  status?: string;
  priceMin?: number;
  priceMax?: number;
};

export type ItemPurchaseDetail = {
  purchase: PurchaseRow | null;
  wearCount: number;
  costPerWear: number | null;
};

export type SpendingAmountItem = {
  id: string | null;
  name: string;
  amount: number;
};

export type MonthlySpendingItem = {
  month: string;
  label: string;
  amount: number;
};

export type PurchaseAnalyticsItem = {
  id: string;
  code: string;
  name: string;
  price: number;
  brand: string | null;
  category: string | null;
  wearCount: number;
  costPerWear: number | null;
};

export type PurchaseAnalytics = {
  totalWardrobeValue: number;
  averageCostPerWear: number | null;
  mostExpensiveItem: PurchaseAnalyticsItem | null;
  cheapestItem: PurchaseAnalyticsItem | null;
  topBrandsByValue: SpendingAmountItem[];
  spendingByBrand: SpendingAmountItem[];
  spendingByCategory: SpendingAmountItem[];
  monthlyTimeline: MonthlySpendingItem[];
};

export type WearLogRow = {
  id: string;
  item_id: string;
  worn_on: string;
  outfit_id: string | null;
  occasion_id: string | null;
  comfort_rating: number | null;
  notes: string | null;
  created_at: string | null;
};

export type WearLogListRow = WearLogRow & {
  item: {
    id: string;
    code: string;
    name: string;
    category: LookupOption | null;
  } | null;
  occasion: LookupOption | null;
};

export type CreateWearLogInput = {
  item_id: string;
  worn_on: string;
  occasion_id?: string | null;
  comfort_rating?: number | null;
  notes?: string | null;
};

export type WearLogFilters = {
  itemId?: string;
  categoryId?: string;
  occasionId?: string;
  wornFrom?: string;
  wornTo?: string;
};

export type ItemWearSummary = {
  totalWears: number;
  lastWornOn: string | null;
  averageComfortRating: number | null;
  recentLogs: WearLogListRow[];
};

export type WearAnalyticsItem = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  wearCount: number;
  lastWornOn: string | null;
};

export type WearLogAnalytics = {
  mostWorn: WearAnalyticsItem[];
  leastWornActive: WearAnalyticsItem[];
  notWornYet: WearAnalyticsItem[];
  recentlyWorn: WearAnalyticsItem[];
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

export type BulkImportResult = {
  imported: number;
};

export const CSV_IMPORT_COLUMNS = [
  "code",
  "name",
  "category",
  "subcategory",
  "brand",
  "primary_color",
  "status",
  "ownership",
  "fit",
  "formality",
  "rating",
  "usage",
  "notes",
] as const;

export type CsvImportColumn = (typeof CSV_IMPORT_COLUMNS)[number];

export type ValidatedImportRow = {
  rowNumber: number;
  raw: Record<CsvImportColumn, string>;
  input: CreateWardrobeItemInput | null;
  errors: string[];
  isValid: boolean;
};

export type ImportValidationResult = {
  rows: ValidatedImportRow[];
  fileError: string | null;
};

export type JsonImportOccasionInput = {
  name: string;
  score?: number | null;
};

export type JsonImportCareInput = {
  storage?: string | null;
  wash?: string | null;
  notes?: string | null;
};

export type JsonImportItemInput = {
  code: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  primary_color: string;
  status?: string | null;
  ownership?: string | null;
  fit?: string | null;
  formality?: string | null;
  rating?: number | null;
  usage?: string | null;
  purchase_year?: number | null;
  favorite?: boolean | null;
  notes?: string | null;
  materials?: string[];
  seasons?: string[];
  styles?: string[];
  features?: string[];
  tags?: string[];
  occasions?: JsonImportOccasionInput[];
  care?: JsonImportCareInput | null;
};

export type JsonImportFile = {
  version: string;
  import_type: string;
  items: JsonImportItemInput[];
};

export type JsonImportPayload = {
  item: CreateWardrobeItemInput;
  materialIds: string[];
  seasonIds: string[];
  styleIds: string[];
  featureIds: string[];
  tagIds: string[];
  occasions: { occasion_id: string; score: number | null }[];
  care: {
    storage_type_id: string | null;
    storage: string | null;
    wash: string | null;
    notes: string | null;
  } | null;
};

export type JsonSyncAction = "insert" | "update";

export type ValidatedJsonImportRow = {
  rowNumber: number;
  code: string;
  name: string;
  category: string;
  brand: string;
  errors: string[];
  isValid: boolean;
  syncAction: JsonSyncAction | null;
  payload: JsonImportPayload | null;
};

export type JsonImportValidationResult = {
  rows: ValidatedJsonImportRow[];
  fileError: string | null;
};

export type JsonBulkImportResult = {
  inserted: number;
  updated: number;
  failed: { code: string; error: string }[];
  skipped: number;
};

export type ImportPreviewRow = {
  rowNumber: number;
  code: string;
  name: string;
  category: string;
  brand: string;
  errors: string[];
  isValid: boolean;
  syncAction?: JsonSyncAction | null;
};

export type ItemOccasionRelation = {
  id: string;
  score: number | null;
  notes: string | null;
  occasion: LookupOption | null;
};

export type ItemCareProfile = {
  wash: string | null;
  storage: string | null;
  notes: string | null;
  storage_type: LookupOption | null;
};

export type WardrobeItemRelations = {
  materials: LookupOption[];
  seasons: LookupOption[];
  styles: LookupOption[];
  features: LookupOption[];
  tags: LookupOption[];
  occasions: ItemOccasionRelation[];
  care: ItemCareProfile | null;
};

export type WardrobeItemDetail = {
  item: WardrobeItemRow;
  images: ItemImageRow[];
  relations: WardrobeItemRelations;
};

export const EMPTY_WARDROBE_ITEM_RELATIONS: WardrobeItemRelations = {
  materials: [],
  seasons: [],
  styles: [],
  features: [],
  tags: [],
  occasions: [],
  care: null,
};

export type DuplicateMatchReason = "same_code" | "similar_name";

export type DuplicateGroup = {
  id: string;
  reason: DuplicateMatchReason;
  label: string;
  items: WardrobeItemRow[];
};

export type ReviewCleanupResult = {
  groups: DuplicateGroup[];
  totalItems: number;
  duplicateItemCount: number;
};

export type BulkCleanupMode = "retire" | "hard_delete";

export type BulkCleanupResult = {
  processed: number;
  mode: BulkCleanupMode;
};

export type BulkEditLookups = {
  tags: LookupOption[];
  seasons: LookupOption[];
  styles: LookupOption[];
};

export type BulkEditAction =
  | { type: "set_status"; value: ItemStatus }
  | { type: "set_usage"; value: UsageFrequency }
  | { type: "set_formality"; value: FormalityEnum | null }
  | { type: "set_fit"; value: FitType }
  | { type: "set_favorite"; value: boolean }
  | { type: "add_tag"; tagId: string }
  | { type: "remove_tag"; tagId: string }
  | { type: "add_season"; seasonId: string }
  | { type: "remove_season"; seasonId: string }
  | { type: "add_style"; styleId: string }
  | { type: "remove_style"; styleId: string };

export type BulkEditInput = {
  itemIds: string[];
  action: BulkEditAction;
};

export type BulkEditResult = {
  affected: number;
  itemCount: number;
  action: BulkEditAction;
};

export const BULK_EDIT_ACTION_OPTIONS: {
  type: BulkEditAction["type"];
  label: string;
  category: "field" | "relation";
}[] = [
  { type: "set_status", label: "Update status", category: "field" },
  { type: "set_usage", label: "Update usage", category: "field" },
  { type: "set_formality", label: "Update formality", category: "field" },
  { type: "set_fit", label: "Update fit", category: "field" },
  { type: "set_favorite", label: "Update favorite", category: "field" },
  { type: "add_tag", label: "Add tag", category: "relation" },
  { type: "remove_tag", label: "Remove tag", category: "relation" },
  { type: "add_season", label: "Add season", category: "relation" },
  { type: "remove_season", label: "Remove season", category: "relation" },
  { type: "add_style", label: "Add style", category: "relation" },
  { type: "remove_style", label: "Remove style", category: "relation" },
];

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

export const PURCHASE_STATUSES: PurchaseStatus[] = [
  "active",
  "returned",
  "pending",
  "cancelled",
];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function calculateCostPerWear(
  price: number | null | undefined,
  wearCount: number,
): number | null {
  if (price === null || price === undefined || wearCount === 0) {
    return null;
  }
  return Math.round((price / wearCount) * 100) / 100;
}

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

export const DEFAULT_PRIMARY_IMAGE_TYPE: ImageType = "worn";

export const WARDROBE_IMAGES_BUCKET = "wardrobe-images";

export function formatEnumLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return value.toFixed(1);
}

export function countActiveFilters(filters: InventoryFilters): number {
  let count = 0;
  if (filters.search?.trim()) count += 1;
  if (filters.categoryId) count += 1;
  if (filters.subcategoryId) count += 1;
  if (filters.brandId) count += 1;
  if (filters.primaryColorId) count += 1;
  if (filters.status) count += 1;
  if (filters.usage) count += 1;
  if (
    filters.sort &&
    (filters.sort.field !== DEFAULT_INVENTORY_SORT.field ||
      filters.sort.ascending !== DEFAULT_INVENTORY_SORT.ascending)
  ) {
    count += 1;
  }
  return count;
}

export function hasActiveFilters(filters: InventoryFilters): boolean {
  return countActiveFilters(filters) > 0;
}
