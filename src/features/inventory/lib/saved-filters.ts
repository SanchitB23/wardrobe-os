import type { QuickFilterKey } from "@/features/inventory/lib/inventory-view";
import type { InventoryFilters } from "@/types/wardrobe";

export type SavedFilter = {
  id: string;
  name: string;
  filters: InventoryFilters;
  quickFilters: QuickFilterKey[];
  /** Built-in presets are seeded and cannot be deleted. */
  builtIn?: boolean;
};

/**
 * Built-in starter presets expressible with the current filter model.
 * (Occasion/season presets like "Office"/"Winter" become available once the
 * inventory filter model gains those dimensions.)
 */
export const BUILT_IN_SAVED_FILTERS: SavedFilter[] = [
  {
    id: "builtin:favorites",
    name: "Favorites",
    filters: {},
    quickFilters: ["favorites"],
    builtIn: true,
  },
  {
    id: "builtin:hero",
    name: "Hero Pieces",
    filters: {},
    quickFilters: ["hero"],
    builtIn: true,
  },
];

const STORAGE_KEY = "wardrobe-os.inventory-saved-filters";

function readUserFilters(): SavedFilter[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedFilter[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUserFilters(filters: SavedFilter[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Best-effort persistence.
  }
}

/** All saved filters: built-in presets first, then user-created. */
export function getSavedFilters(): SavedFilter[] {
  return [...BUILT_IN_SAVED_FILTERS, ...readUserFilters()];
}

export function saveFilter(input: {
  name: string;
  filters: InventoryFilters;
  quickFilters: QuickFilterKey[];
}): SavedFilter {
  const entry: SavedFilter = {
    id: `user:${Date.now()}`,
    name: input.name.trim(),
    filters: input.filters,
    quickFilters: input.quickFilters,
  };
  writeUserFilters([...readUserFilters(), entry]);
  return entry;
}

export function deleteSavedFilter(id: string): void {
  writeUserFilters(readUserFilters().filter((entry) => entry.id !== id));
}
