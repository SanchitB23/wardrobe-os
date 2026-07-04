"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlusIcon, UploadIcon } from "lucide-react";

import { CategoryFilterCards } from "@/components/inventory/category-filter-cards";
import { DeleteItemDialog } from "@/components/inventory/delete-item-dialog";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { InventoryEmptyState } from "@/components/inventory/inventory-empty-state";
import { InventoryFiltersPanel } from "@/components/inventory/inventory-filters";
import {
  InventoryTable,
  InventoryTableSkeleton,
} from "@/components/inventory/inventory-table";
import {
  InventorySummaryCards,
  InventorySummaryCardsSkeleton,
} from "@/components/inventory/inventory-summary-cards";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryCountFilters } from "@/lib/wardrobe/query-keys";
import {
  useCategoryCounts,
  useInventorySummary,
  useWardrobeItems,
  useWardrobeLookups,
} from "@/lib/wardrobe/hooks";
import {
  DEFAULT_INVENTORY_SORT,
  hasActiveFilters,
  type InventoryFilters,
  type WardrobeItemRow,
} from "@/types/wardrobe";

const EMPTY_SUMMARY = {
  totalItems: 0,
  activeItems: 0,
  heroPieces: 0,
  averageRating: null,
};

export function InventoryDashboard() {
  const [filters, setFilters] = useState<InventoryFilters>({
    sort: DEFAULT_INVENTORY_SORT,
  });
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search ?? "");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedItem, setSelectedItem] = useState<WardrobeItemRow | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<WardrobeItemRow | null>(
    null,
  );

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearch(filters.search ?? ""),
      filters.search ? 300 : 0,
    );
    return () => clearTimeout(timeout);
  }, [filters.search]);

  const queryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const countFilters = useMemo<CategoryCountFilters>(
    () => ({
      search: debouncedSearch,
      status: filters.status,
      subcategoryId: filters.subcategoryId,
      brandId: filters.brandId,
      primaryColorId: filters.primaryColorId,
      usage: filters.usage,
    }),
    [
      debouncedSearch,
      filters.status,
      filters.subcategoryId,
      filters.brandId,
      filters.primaryColorId,
      filters.usage,
    ],
  );

  const summaryQuery = useInventorySummary();
  const itemsQuery = useWardrobeItems(queryFilters);
  const countsQuery = useCategoryCounts(countFilters);
  const lookupsQuery = useWardrobeLookups();

  const queries = [summaryQuery, itemsQuery, countsQuery, lookupsQuery];
  const isInitialLoading = queries.some((query) => query.isPending);
  const isRefetching = queries.some((query) => query.isFetching && !query.isPending);
  const error = queries.find((query) => query.error)?.error?.message ?? null;

  const summary = summaryQuery.data ?? EMPTY_SUMMARY;
  const items = itemsQuery.data ?? [];
  const categoryCounts = countsQuery.data ?? {
    total: 0,
    uncategorized: 0,
    categories: [],
  };
  const lookups = lookupsQuery.data ?? {
    categories: [],
    subcategories: [],
    brands: [],
    colors: [],
  };

  function handleRetry() {
    void Promise.all(queries.map((query) => query.refetch()));
  }

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
      subcategoryId:
        categoryId && categoryId !== current.categoryId
          ? undefined
          : current.subcategoryId,
    }));
  }

  function clearFilters() {
    setFilters({ sort: DEFAULT_INVENTORY_SORT });
  }

  const showEmptyState = !isInitialLoading && !error && items.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-6 py-8 lg:px-8 lg:py-10">
      <header className="flex items-start justify-between gap-6 border-b pb-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Wardrobe OS
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              Inventory
            </h1>
            {!isInitialLoading && !error && (
              <Badge variant="secondary" className="tabular-nums">
                {items.length} shown
              </Badge>
            )}
            {isRefetching && (
              <Badge variant="outline" className="text-muted-foreground">
                Updating…
              </Badge>
            )}
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Manage your wardrobe catalog, filter by attributes, and track your
            best pieces.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" render={<Link href="/inventory/import" />}>
            <UploadIcon />
            Import
          </Button>
          <Button onClick={openCreateDialog}>
            <PlusIcon />
            Add item
          </Button>
        </div>
      </header>

      {isInitialLoading ? (
        <InventorySummaryCardsSkeleton />
      ) : (
        <InventorySummaryCards summary={summary} />
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Browse by category</h2>
            <p className="text-xs text-muted-foreground">
              Counts reflect your current search and filter selection.
            </p>
          </div>
        </div>
        {isInitialLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
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
      </section>

      <InventoryFiltersPanel
        filters={filters}
        lookups={lookups}
        onChange={setFilters}
        onClear={clearFilters}
      />

      {error ? (
        <InventoryErrorState
          message={error}
          onRetry={handleRetry}
          isRetrying={isRefetching}
        />
      ) : isInitialLoading ? (
        <InventoryTableSkeleton />
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
      />

      <DeleteItemDialog
        item={itemToDelete}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
