"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatEnumLabel,
  INVENTORY_SORT_OPTIONS,
  ITEM_STATUSES,
  type InventoryFilters,
  type InventorySortField,
} from "@/types/wardrobe";

type InventoryFiltersBarProps = {
  filters: InventoryFilters;
  onChange: (filters: InventoryFilters) => void;
};

export function InventoryFiltersBar({
  filters,
  onChange,
}: InventoryFiltersBarProps) {
  const sortField = filters.sort?.field ?? "created_at";

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

  const sortAscending = filters.sort?.ascending ?? false;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1 space-y-1.5">
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

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="w-full space-y-1.5 sm:w-[160px]">
          <Label>Status</Label>
          <Select
            value={filters.status ?? ""}
            onValueChange={(value) =>
              onChange({
                ...filters,
                status: !value
                  ? undefined
                  : (value as InventoryFilters["status"]),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              {ITEM_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {formatEnumLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full space-y-1.5 sm:w-[180px]">
          <Label>Sort by</Label>
          <Select
            value={sortField}
            onValueChange={(value) =>
              handleSortFieldChange(value as InventorySortField)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
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

        <div className="w-full space-y-1.5 sm:w-auto">
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
            <SelectTrigger className="w-full sm:w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
