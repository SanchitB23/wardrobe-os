import type { SortableColumn } from "@/features/inventory/lib/inventory-view";

export type ColumnKey =
  | "image"
  | "code"
  | "name"
  | "category"
  | "brand"
  | "color"
  | "status"
  | "usage"
  | "rating";

export type ColumnDef = {
  key: ColumnKey;
  label: string;
  /** Corresponding sortable column, when the header supports sorting. */
  sort?: SortableColumn;
  /** Columns that cannot be hidden. */
  locked?: boolean;
};

export const INVENTORY_COLUMNS: ColumnDef[] = [
  { key: "image", label: "Image" },
  { key: "code", label: "Code", sort: "code" },
  { key: "name", label: "Name", sort: "name", locked: true },
  { key: "category", label: "Category", sort: "category" },
  { key: "brand", label: "Brand", sort: "brand" },
  { key: "color", label: "Color", sort: "color" },
  { key: "status", label: "Status", sort: "status" },
  { key: "usage", label: "Usage", sort: "usage" },
  { key: "rating", label: "Rating", sort: "rating" },
];

const STORAGE_KEY = "wardrobe-os.inventory-hidden-columns";

/** Column keys the user has chosen to hide, read from localStorage. */
export function getHiddenColumns(): Set<ColumnKey> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ColumnKey[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function setHiddenColumns(hidden: ReadonlySet<ColumnKey>): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
  } catch {
    // Best-effort persistence.
  }
}
