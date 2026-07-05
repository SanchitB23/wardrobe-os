"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";

import { PageHeader } from "@/features/layout";
import { BulkActionsToolbar } from "@/features/inventory/components/bulk-actions-toolbar";
import { CategoryFilterCards } from "@/features/inventory/components/category-filter-cards";
import { DeleteItemDialog } from "@/features/inventory/components/delete-item-dialog";
import { LogWearDialog } from "@/features/wear-logs/components/log-wear-dialog";
import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { InventoryEmptyState } from "@/features/inventory/components/inventory-empty-state";
import { InventoryFiltersPanel } from "@/features/inventory/components/inventory-filters";
import {
  InventoryTable,
  InventoryTableSkeleton,
} from "@/features/inventory/components/inventory-table";
import {
  InventorySummaryCards,
  InventorySummaryCardsSkeleton,
} from "@/features/inventory/components/inventory-summary-cards";
import { ItemFormDialog } from "@/features/inventory/components/item-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryCountFilters } from "@/shared/query/wardrobe-keys";
import {
  useCategoryCounts,
  useInventorySummary,
  useWardrobeItems,
  useWardrobeLookups,
} from "@/features/inventory/hooks";
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
  const [logWearOpen, setLogWearOpen] = useState(false);
  const [itemToLogWear, setItemToLogWear] = useState<WardrobeItemRow | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Deep link from the command palette: /inventory?action=add-item
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "add-item") {
      setFormMode("create");
      setSelectedItem(null);
      setFormOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

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
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const visibleItemIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items],
  );
  const visibleSelectedIds = useMemo(
    () => new Set([...selectedIds].filter((id) => visibleItemIds.has(id))),
    [selectedIds, visibleItemIds],
  );

  function handleSelectedIdsChange(nextVisible: Set<string>) {
    setSelectedIds((current) => {
      const hidden = [...current].filter((id) => !visibleItemIds.has(id));
      return new Set([...hidden, ...nextVisible]);
    });
  }

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

  function openLogWearDialog(item: WardrobeItemRow) {
    setItemToLogWear(item);
    setLogWearOpen(true);
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
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-6 py-8 pb-28 lg:px-8 lg:py-10">
      <PageHeader
        className="border-b pb-6"
        title="Inventory"
        badge={
          <>
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
          </>
        }
        description="Manage your wardrobe catalog, filter by attributes, and track your best pieces."
        actions={
          <Button onClick={openCreateDialog}>
            <PlusIcon />
            Add item
          </Button>
        }
      />

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
          selectedIds={visibleSelectedIds}
          onSelectedIdsChange={handleSelectedIdsChange}
          onEdit={openEditDialog}
          onDelete={openDeleteDialog}
          onLogWear={openLogWearDialog}
        />
      )}

      <BulkActionsToolbar
        selectedCount={visibleSelectedIds.size}
        selectedIds={[...visibleSelectedIds]}
        onClearSelection={() => setSelectedIds(new Set())}
        onCompleted={() => void itemsQuery.refetch()}
      />

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

      <LogWearDialog
        item={itemToLogWear}
        open={logWearOpen}
        onOpenChange={setLogWearOpen}
      />
    </div>
  );
}
