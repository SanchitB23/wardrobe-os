"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkIcon,
  ChevronDownIcon,
  Columns3Icon,
  PlusIcon,
  XIcon,
} from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryCountFilters } from "@/shared/query/wardrobe-keys";
import {
  useCategoryCounts,
  useInventorySummary,
  useWardrobeItems,
  useWardrobeLookups,
} from "@/features/inventory/hooks";
import {
  INVENTORY_COLUMNS,
  getHiddenColumns,
  setHiddenColumns as persistHiddenColumns,
  type ColumnKey,
} from "@/features/inventory/lib/inventory-columns";
import {
  applyQuickFilters,
  parseInventoryParams,
  QUICK_FILTERS,
  serializeInventoryParams,
  sortItems,
  type QuickFilterKey,
  type SortRule,
} from "@/features/inventory/lib/inventory-view";
import {
  deleteSavedFilter,
  getSavedFilters,
  saveFilter,
  type SavedFilter,
} from "@/features/inventory/lib/saved-filters";
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

const PAGE_SIZE = 50;

const HIDEABLE_COLUMNS = INVENTORY_COLUMNS.filter((column) => !column.locked);

export function InventoryDashboard() {
  const [filters, setFilters] = useState<InventoryFilters>({
    sort: DEFAULT_INVENTORY_SORT,
  });
  const [quickFilters, setQuickFilters] = useState<Set<QuickFilterKey>>(
    new Set(),
  );
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  const [debouncedSearch, setDebouncedSearch] = useState(filters.search ?? "");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedItem, setSelectedItem] = useState<WardrobeItemRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<WardrobeItemRow | null>(null);
  const [logWearOpen, setLogWearOpen] = useState(false);
  const [itemToLogWear, setItemToLogWear] = useState<WardrobeItemRow | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const hydratedRef = useRef(false);

  const summaryQuery = useInventorySummary();
  const lookupsQuery = useWardrobeLookups();

  // Load persisted column visibility + saved filters once on mount.
  useEffect(() => {
    setHiddenColumns(getHiddenColumns());
    setSavedFilters(getSavedFilters());
  }, []);

  // Hydrate filters/quick filters from the URL once lookups are available.
  useEffect(() => {
    if (hydratedRef.current || !lookupsQuery.data) {
      return;
    }
    hydratedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "add-item") {
      setFormMode("create");
      setSelectedItem(null);
      setFormOpen(true);
    }

    const parsed = parseInventoryParams(params, lookupsQuery.data);
    setFilters((current) => ({ ...current, ...parsed.filters }));
    setQuickFilters(parsed.quickFilters);
  }, [lookupsQuery.data]);

  // Reflect filters + quick filters into the URL (shareable, no history spam).
  useEffect(() => {
    if (!hydratedRef.current || !lookupsQuery.data) {
      return;
    }
    const query = serializeInventoryParams(
      { filters, quickFilters },
      lookupsQuery.data,
    );
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [filters, quickFilters, lookupsQuery.data]);

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

  const itemsQuery = useWardrobeItems(queryFilters);
  const countsQuery = useCategoryCounts(countFilters);

  const queries = [summaryQuery, itemsQuery, countsQuery, lookupsQuery];
  const isInitialLoading = queries.some((query) => query.isPending);
  const isRefetching = queries.some(
    (query) => query.isFetching && !query.isPending,
  );
  const error = queries.find((query) => query.error)?.error?.message ?? null;

  const summary = summaryQuery.data ?? EMPTY_SUMMARY;
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);

  // Client-side pipeline: quick filters → multi-column sort. Memoized so rows
  // only recompute when their inputs actually change.
  const quickFiltered = useMemo(
    () => applyQuickFilters(items, quickFilters),
    [items, quickFilters],
  );
  const displayItems = useMemo(
    () => sortItems(quickFiltered, sortRules),
    [quickFiltered, sortRules],
  );

  // Reset the infinite-scroll window whenever the result set changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [displayItems]);

  const visibleItemIds = useMemo(
    () => new Set(displayItems.map((item) => item.id)),
    [displayItems],
  );
  const visibleSelectedIds = useMemo(
    () => new Set([...selectedIds].filter((id) => visibleItemIds.has(id))),
    [selectedIds, visibleItemIds],
  );

  const handleSelectedIdsChange = useCallback(
    (nextVisible: Set<string>) => {
      setSelectedIds((current) => {
        const hidden = [...current].filter((id) => !visibleItemIds.has(id));
        return new Set([...hidden, ...nextVisible]);
      });
    },
    [visibleItemIds],
  );

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

  const openCreateDialog = useCallback(() => {
    setFormMode("create");
    setSelectedItem(null);
    setFormOpen(true);
  }, []);

  const openEditDialog = useCallback((item: WardrobeItemRow) => {
    setFormMode("edit");
    setSelectedItem(item);
    setFormOpen(true);
  }, []);

  const openDeleteDialog = useCallback((item: WardrobeItemRow) => {
    setItemToDelete(item);
    setDeleteOpen(true);
  }, []);

  const openLogWearDialog = useCallback((item: WardrobeItemRow) => {
    setItemToLogWear(item);
    setLogWearOpen(true);
  }, []);

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

  function toggleQuickFilter(key: QuickFilterKey) {
    setQuickFilters((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const handleToggleSort = useCallback(
    (column: SortRule["column"], additive: boolean) => {
      setSortRules((rules) => {
        const existing = rules.find((rule) => rule.column === column);
        if (additive) {
          if (!existing) {
            return [...rules, { column, direction: "asc" }];
          }
          if (existing.direction === "asc") {
            return rules.map((rule) =>
              rule.column === column ? { ...rule, direction: "desc" } : rule,
            );
          }
          return rules.filter((rule) => rule.column !== column);
        }
        if (!existing) {
          return [{ column, direction: "asc" }];
        }
        if (existing.direction === "asc") {
          return [{ column, direction: "desc" }];
        }
        return [];
      });
    },
    [],
  );

  function toggleColumn(key: ColumnKey) {
    setHiddenColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      persistHiddenColumns(next);
      return next;
    });
  }

  function clearFilters() {
    setFilters({ sort: DEFAULT_INVENTORY_SORT });
    setQuickFilters(new Set());
    setSortRules([]);
  }

  function applySavedFilter(saved: SavedFilter) {
    setFilters({ sort: DEFAULT_INVENTORY_SORT, ...saved.filters });
    setQuickFilters(new Set(saved.quickFilters));
  }

  function handleSaveCurrentFilter() {
    const name = window.prompt("Name this filter");
    if (!name?.trim()) {
      return;
    }
    saveFilter({
      name,
      filters,
      quickFilters: [...quickFilters],
    });
    setSavedFilters(getSavedFilters());
  }

  function handleDeleteSavedFilter(id: string) {
    deleteSavedFilter(id);
    setSavedFilters(getSavedFilters());
  }

  const showEmptyState = !isInitialLoading && !error && displayItems.length === 0;
  const anyFiltersActive =
    hasActiveFilters(filters) || quickFilters.size > 0 || sortRules.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-6 py-8 pb-28 lg:px-8 lg:py-10">
      <PageHeader
        className="border-b pb-6"
        title="Inventory"
        badge={
          <>
            {!isInitialLoading && !error && (
              <Badge variant="secondary" className="tabular-nums">
                {displayItems.length} shown
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

      {/* Quick filters + saved filters + column management */}
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_FILTERS.map((quick) => {
          const active = quickFilters.has(quick.key);
          return (
            <Button
              key={quick.key}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => toggleQuickFilter(quick.key)}
            >
              {quick.label}
            </Button>
          );
        })}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              <BookmarkIcon />
              Saved filters
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Apply a saved filter</DropdownMenuLabel>
              {savedFilters.map((saved) => (
                <DropdownMenuItem
                  key={saved.id}
                  onClick={() => applySavedFilter(saved)}
                >
                  {saved.name}
                  {!saved.builtIn ? (
                    <XIcon
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteSavedFilter(saved.id);
                      }}
                    />
                  ) : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!anyFiltersActive}
                onClick={handleSaveCurrentFilter}
              >
                <BookmarkIcon />
                Save current filter…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              <Columns3Icon />
              Columns
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              {HIDEABLE_COLUMNS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={!hiddenColumns.has(column.key)}
                  onCheckedChange={() => toggleColumn(column.key)}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
          hasFilters={anyFiltersActive}
          onAddItem={openCreateDialog}
          onClearFilters={clearFilters}
        />
      ) : (
        <InventoryTable
          items={displayItems}
          visibleCount={visibleCount}
          onLoadMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
          hiddenColumns={hiddenColumns}
          sortRules={sortRules}
          onToggleSort={handleToggleSort}
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
