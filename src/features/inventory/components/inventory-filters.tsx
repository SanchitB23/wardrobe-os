"use client";

import { useMemo } from "react";
import { FilterXIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  countActiveFilters,
  formatEnumLabel,
  FORMALITY_LEVELS,
  INVENTORY_SORT_OPTIONS,
  ITEM_STATUSES,
  type InventoryFilters,
  type InventorySortField,
  type LookupOption,
  type SubcategoryOption,
  type UsageFrequency,
  USAGE_FREQUENCIES,
  UNCATEGORIZED_CATEGORY_ID,
  type WardrobeLookups,
} from "@/types/wardrobe";

type InventoryFiltersPanelProps = {
  filters: InventoryFilters;
  lookups: WardrobeLookups;
  onChange: (filters: InventoryFilters) => void;
  onClear: () => void;
};

type LookupFilterSelectProps = {
  label: string;
  value?: string;
  options: LookupOption[];
  placeholder: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
};

function LookupFilterSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
}: LookupFilterSelectProps) {
  const selectedLabel = options.find((option) => option.id === value)?.name;

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value ?? ""}
        onValueChange={(next) => onChange(next || undefined)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" aria-label={label}>
          <span
            className={
              selectedLabel
                ? "truncate"
                : "truncate text-muted-foreground"
            }
          >
            {selectedLabel ?? placeholder}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type EnumFilterSelectProps = {
  label: string;
  value?: string;
  options: readonly string[];
  placeholder: string;
  onChange: (value: string | undefined) => void;
};

function EnumFilterSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: EnumFilterSelectProps) {
  const selectedLabel = value ? formatEnumLabel(value) : null;

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value ?? ""}
        onValueChange={(next) => onChange(next || undefined)}
      >
        <SelectTrigger className="w-full" aria-label={label}>
          <span
            className={
              selectedLabel
                ? "truncate"
                : "truncate text-muted-foreground"
            }
          >
            {selectedLabel ?? placeholder}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {formatEnumLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function InventoryFiltersPanel({
  filters,
  lookups,
  onChange,
  onClear,
}: InventoryFiltersPanelProps) {
  const sortField = filters.sort?.field ?? "created_at";
  const sortAscending = filters.sort?.ascending ?? false;
  const activeFilterCount = countActiveFilters(filters);

  const filteredSubcategories = useMemo(() => {
    if (!filters.categoryId) {
      return lookups.subcategories;
    }
    return lookups.subcategories.filter(
      (subcategory: SubcategoryOption) =>
        subcategory.category_id === filters.categoryId,
    );
  }, [filters.categoryId, lookups.subcategories]);

  function handleSortFieldChange(field: InventorySortField) {
    const option = INVENTORY_SORT_OPTIONS.find((item) => item.field === field);
    onChange({
      ...filters,
      sort: {
        field,
        ascending: option?.defaultAscending ?? true,
      },
    });
  }

  function handleCategoryChange(categoryId: string | undefined) {
    onChange({
      ...filters,
      categoryId,
      subcategoryId:
        categoryId &&
        filters.subcategoryId &&
        !lookups.subcategories.some(
          (subcategory) =>
            subcategory.id === filters.subcategoryId &&
            subcategory.category_id === categoryId,
        )
          ? undefined
          : filters.subcategoryId,
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Search & filters</CardTitle>
            <CardDescription>
              Narrow your inventory by attributes, status, and usage.
            </CardDescription>
          </div>
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{activeFilterCount} active</Badge>
              <Button variant="ghost" size="sm" onClick={onClear}>
                <FilterXIcon />
                Clear all
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1.5">
          <Label htmlFor="inventory-search">Search</Label>
          <Input
            id="inventory-search"
            placeholder="Search by name or code…"
            value={filters.search ?? ""}
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value })
            }
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <LookupFilterSelect
            label="Category"
            value={
              filters.categoryId === UNCATEGORIZED_CATEGORY_ID
                ? undefined
                : filters.categoryId
            }
            options={lookups.categories}
            placeholder={
              filters.categoryId === UNCATEGORIZED_CATEGORY_ID
                ? "Uncategorized"
                : "All categories"
            }
            onChange={handleCategoryChange}
          />
          <LookupFilterSelect
            label="Subcategory"
            value={filters.subcategoryId}
            options={filteredSubcategories}
            placeholder="All subcategories"
            onChange={(subcategoryId) =>
              onChange({ ...filters, subcategoryId })
            }
            disabled={
              Boolean(filters.categoryId) &&
              filteredSubcategories.length === 0
            }
          />
          <LookupFilterSelect
            label="Brand"
            value={filters.brandId}
            options={lookups.brands}
            placeholder="All brands"
            onChange={(brandId) => onChange({ ...filters, brandId })}
          />
          <LookupFilterSelect
            label="Primary color"
            value={filters.primaryColorId}
            options={lookups.colors}
            placeholder="All colors"
            onChange={(primaryColorId) =>
              onChange({ ...filters, primaryColorId })
            }
          />
          <EnumFilterSelect
            label="Status"
            value={filters.status}
            options={ITEM_STATUSES}
            placeholder="All statuses"
            onChange={(status) =>
              onChange({
                ...filters,
                status: status as InventoryFilters["status"],
              })
            }
          />
          <EnumFilterSelect
            label="Usage"
            value={filters.usage}
            options={USAGE_FREQUENCIES}
            placeholder="All usage levels"
            onChange={(usage) =>
              onChange({
                ...filters,
                usage: usage as UsageFrequency | undefined,
              })
            }
          />
          <EnumFilterSelect
            label="Formality"
            value={filters.formality}
            options={FORMALITY_LEVELS}
            placeholder="All formality levels"
            onChange={(formality) =>
              onChange({
                ...filters,
                formality: formality as InventoryFilters["formality"],
              })
            }
          />
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t pt-4">
          <div className="w-full min-w-[180px] flex-1 space-y-1.5 sm:max-w-[220px]">
            <Label>Sort by</Label>
            <Select
              value={sortField}
              onValueChange={(value) =>
                handleSortFieldChange(value as InventorySortField)
              }
            >
              <SelectTrigger className="w-full" aria-label="Sort by">
                <span>
                  {INVENTORY_SORT_OPTIONS.find(
                    (option) => option.field === sortField,
                  )?.label ?? "Sort"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {INVENTORY_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.field} value={option.field}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-1.5 sm:w-[140px]">
            <Label className="sr-only">Sort direction</Label>
            <Select
              value={sortAscending ? "asc" : "desc"}
              onValueChange={(value) =>
                onChange({
                  ...filters,
                  sort: {
                    field: sortField,
                    ascending: value === "asc",
                  },
                })
              }
            >
              <SelectTrigger className="w-full" aria-label="Sort direction">
                <span>{sortAscending ? "Ascending" : "Descending"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
