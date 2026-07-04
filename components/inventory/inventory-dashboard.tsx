"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon } from "lucide-react";

import { CategoryFilterCards } from "@/components/inventory/category-filter-cards";
import { DeleteItemDialog } from "@/components/inventory/delete-item-dialog";
import { InventoryEmptyState } from "@/components/inventory/inventory-empty-state";
import { InventoryFiltersBar } from "@/components/inventory/inventory-filters";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchCategoryCounts,
  fetchLookups,
  fetchWardrobeItems,
} from "@/lib/wardrobe/queries";
import {
  DEFAULT_INVENTORY_SORT,
  type CategoryCountsResult,
  type InventoryFilters,
  type WardrobeItemRow,
  type WardrobeLookups,
} from "@/types/wardrobe";

const EMPTY_LOOKUPS: WardrobeLookups = {
  categories: [],
  subcategories: [],
  brands: [],
  colors: [],
};

const EMPTY_COUNTS: CategoryCountsResult = {
  total: 0,
  uncategorized: 0,
  categories: [],
};

function hasActiveFilters(filters: InventoryFilters) {
  return Boolean(
    filters.search?.trim() ||
      filters.status ||
      filters.categoryId ||
      (filters.sort &&
        (filters.sort.field !== DEFAULT_INVENTORY_SORT.field ||
          filters.sort.ascending !== DEFAULT_INVENTORY_SORT.ascending)),
  );
}

export function InventoryDashboard() {
  const [items, setItems] = useState<WardrobeItemRow[]>([]);
  const [lookups, setLookups] = useState<WardrobeLookups>(EMPTY_LOOKUPS);
  const [categoryCounts, setCategoryCounts] =
    useState<CategoryCountsResult>(EMPTY_COUNTS);
  const [filters, setFilters] = useState<InventoryFilters>({
    sort: DEFAULT_INVENTORY_SORT,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedItem, setSelectedItem] = useState<WardrobeItemRow | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<WardrobeItemRow | null>(
    null,
  );

  const loadData = useCallback(async (nextFilters: InventoryFilters) => {
    setLoading(true);
    setError(null);

    const countFilters = {
      search: nextFilters.search,
      status: nextFilters.status,
    };

    const [itemsResult, lookupsResult, countsResult] = await Promise.all([
      fetchWardrobeItems(nextFilters),
      fetchLookups(),
      fetchCategoryCounts(countFilters),
    ]);

    if (itemsResult.error || lookupsResult.error || countsResult.error) {
      setError(
        itemsResult.error?.message ??
          lookupsResult.error?.message ??
          countsResult.error?.message ??
          null,
      );
      setItems([]);
      if (lookupsResult.data) {
        setLookups(lookupsResult.data);
      }
      if (countsResult.data) {
        setCategoryCounts(countsResult.data);
      }
      setLoading(false);
      return;
    }

    setItems(itemsResult.data ?? []);
    setLookups(lookupsResult.data ?? EMPTY_LOOKUPS);
    setCategoryCounts(countsResult.data ?? EMPTY_COUNTS);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(
      () => {
        void loadData(filters);
      },
      filters.search ? 300 : 0,
    );

    return () => clearTimeout(timeout);
  }, [filters, loadData]);

  function openCreateDialog() {
    setFormMode("create");
    setSelectedItem(null);
    setFormOpen(true);
  }

  function openEditDialog(item: WardrobeItemRow) {
    setFormMode("edit");
    setSelectedItem(item);
    setFormOpen(true);
  }

  function openDeleteDialog(item: WardrobeItemRow) {
    setItemToDelete(item);
    setDeleteOpen(true);
  }

  function handleCategorySelect(categoryId: string | undefined) {
    setFilters((current) => ({
      ...current,
      categoryId,
    }));
  }

  function clearFilters() {
    setFilters({ sort: DEFAULT_INVENTORY_SORT });
  }

  const showEmptyState = !loading && !error && items.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Wardrobe OS
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Inventory
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse, filter, and manage your wardrobe catalog.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={openCreateDialog}>
          <PlusIcon />
          Add item
        </Button>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[88px] rounded-xl" />
          ))}
        </div>
      ) : (
        <CategoryFilterCards
          counts={categoryCounts}
          selectedCategoryId={filters.categoryId}
          onSelect={handleCategorySelect}
        />
      )}

      <InventoryFiltersBar filters={filters} onChange={setFilters} />

      {error && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
          {error.includes("row-level security") && (
            <p className="mt-2 text-muted-foreground">
              RLS is enabled but no policies exist yet. Add SELECT/INSERT/UPDATE/DELETE
              policies on inventory tables before this dashboard can read or write data.
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : showEmptyState ? (
        <InventoryEmptyState
          hasFilters={hasActiveFilters(filters)}
          onAddItem={openCreateDialog}
          onClearFilters={clearFilters}
        />
      ) : (
        <InventoryTable
          items={items}
          onEdit={openEditDialog}
          onDelete={openDeleteDialog}
        />
      )}

      <ItemFormDialog
        mode={formMode}
        open={formOpen}
        item={selectedItem}
        lookups={lookups}
        onOpenChange={setFormOpen}
        onSuccess={() => void loadData(filters)}
      />

      <DeleteItemDialog
        item={itemToDelete}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => void loadData(filters)}
      />
    </div>
  );
}
