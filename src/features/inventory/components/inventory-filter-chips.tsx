"use client";

import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  QUICK_FILTERS,
  type QuickFilterKey,
} from "@/features/inventory/lib/inventory-view";
import {
  formatEnumLabel,
  type InventoryFilters,
  type LookupOption,
  type WardrobeImportLookups,
} from "@/types/wardrobe";

type Chip = {
  key: string;
  label: string;
  onRemove: () => void;
};

function nameById(options: LookupOption[], id: string): string {
  return options.find((option) => option.id === id)?.name ?? id;
}

type InventoryFilterChipsProps = {
  filters: InventoryFilters;
  quickFilters: Set<QuickFilterKey>;
  lookups: WardrobeImportLookups;
  onChange: (filters: InventoryFilters) => void;
  onToggleQuick: (key: QuickFilterKey) => void;
  onClearAll: () => void;
};

export function InventoryFilterChips({
  filters,
  quickFilters,
  lookups,
  onChange,
  onToggleQuick,
  onClearAll,
}: InventoryFilterChipsProps) {
  const chips: Chip[] = [];

  const set = (patch: Partial<InventoryFilters>) =>
    onChange({ ...filters, ...patch });

  if (filters.categoryId) {
    chips.push({
      key: "category",
      label: `Category: ${nameById(lookups.categories, filters.categoryId)}`,
      onRemove: () => set({ categoryId: undefined, subcategoryId: undefined }),
    });
  }
  if (filters.subcategoryId) {
    chips.push({
      key: "subcategory",
      label: `Subcategory: ${nameById(lookups.subcategories, filters.subcategoryId)}`,
      onRemove: () => set({ subcategoryId: undefined }),
    });
  }
  if (filters.brandId) {
    chips.push({
      key: "brand",
      label: `Brand: ${nameById(lookups.brands, filters.brandId)}`,
      onRemove: () => set({ brandId: undefined }),
    });
  }
  if (filters.primaryColorId) {
    chips.push({
      key: "color",
      label: `Color: ${nameById(lookups.colors, filters.primaryColorId)}`,
      onRemove: () => set({ primaryColorId: undefined }),
    });
  }
  if (filters.status) {
    chips.push({
      key: "status",
      label: `Status: ${formatEnumLabel(filters.status)}`,
      onRemove: () => set({ status: undefined }),
    });
  }
  if (filters.usage) {
    chips.push({
      key: "usage",
      label: `Usage: ${formatEnumLabel(filters.usage)}`,
      onRemove: () => set({ usage: undefined }),
    });
  }
  if (filters.formality) {
    chips.push({
      key: "formality",
      label: `Formality: ${formatEnumLabel(filters.formality)}`,
      onRemove: () => set({ formality: undefined }),
    });
  }
  if (filters.fit) {
    chips.push({
      key: "fit",
      label: `Fit: ${formatEnumLabel(filters.fit)}`,
      onRemove: () => set({ fit: undefined }),
    });
  }
  if (filters.ratingMin !== undefined || filters.ratingMax !== undefined) {
    chips.push({
      key: "rating",
      label: `Rating: ${filters.ratingMin ?? 0}–${filters.ratingMax ?? 10}`,
      onRemove: () => set({ ratingMin: undefined, ratingMax: undefined }),
    });
  }
  if (filters.hasImage !== undefined) {
    chips.push({
      key: "hasImage",
      label: filters.hasImage ? "Has image" : "Missing image",
      onRemove: () => set({ hasImage: undefined }),
    });
  }
  if (filters.wornStatus) {
    chips.push({
      key: "worn",
      label: filters.wornStatus === "worn" ? "Worn" : "Never worn",
      onRemove: () => set({ wornStatus: undefined }),
    });
  }
  if (filters.purchaseStatus) {
    chips.push({
      key: "purchase",
      label: `Purchase: ${formatEnumLabel(filters.purchaseStatus)}`,
      onRemove: () => set({ purchaseStatus: undefined }),
    });
  }

  const facetChips: {
    key: keyof InventoryFilters;
    label: string;
    options: LookupOption[];
  }[] = [
    { key: "seasonIds", label: "Season", options: lookups.seasons },
    { key: "styleIds", label: "Style", options: lookups.styles },
    { key: "materialIds", label: "Material", options: lookups.materials },
    { key: "featureIds", label: "Feature", options: lookups.features },
    { key: "tagIds", label: "Tag", options: lookups.tags },
    { key: "occasionIds", label: "Occasion", options: lookups.occasions },
  ];

  for (const facet of facetChips) {
    const ids = (filters[facet.key] as string[] | undefined) ?? [];
    for (const id of ids) {
      chips.push({
        key: `${String(facet.key)}-${id}`,
        label: `${facet.label}: ${nameById(facet.options, id)}`,
        onRemove: () =>
          set({
            [facet.key]: ids.filter((value) => value !== id).length
              ? ids.filter((value) => value !== id)
              : undefined,
          } as Partial<InventoryFilters>),
      });
    }
  }

  for (const quick of QUICK_FILTERS) {
    if (quickFilters.has(quick.key)) {
      chips.push({
        key: `quick-${quick.key}`,
        label: quick.label,
        onRemove: () => onToggleQuick(quick.key),
      });
    }
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        Active filters:
      </span>
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
          {chip.label}
          <button
            type="button"
            aria-label={`Remove ${chip.label}`}
            onClick={chip.onRemove}
            className="rounded-full p-0.5 outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <Button variant="ghost" size="sm" onClick={onClearAll}>
        Clear all
      </Button>
    </div>
  );
}
