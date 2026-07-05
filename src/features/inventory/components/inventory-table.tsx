"use client";

import { useRouter } from "next/navigation";
import { memo, useEffect, useRef } from "react";
import {
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarPlusIcon,
  ImageIcon,
  MoreHorizontalIcon,
  PencilIcon,
} from "lucide-react";

import { ItemImage } from "@/features/inventory/components/item-image";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  INVENTORY_COLUMNS,
  type ColumnKey,
} from "@/features/inventory/lib/inventory-columns";
import type { SortRule } from "@/features/inventory/lib/inventory-view";
import { buildItemImageAltText } from "@/features/inventory/services/images.service";
import { ColorSwatch, Rating, StatusBadge, UsageBadge } from "@/shared/ui";
import { cn } from "@/lib/utils";
import { type WardrobeItemRow } from "@/types/wardrobe";

type InventoryTableProps = {
  items: WardrobeItemRow[];
  visibleCount: number;
  onLoadMore: () => void;
  hiddenColumns: Set<ColumnKey>;
  sortRules: SortRule[];
  onToggleSort: (column: NonNullable<(typeof INVENTORY_COLUMNS)[number]["sort"]>, additive: boolean) => void;
  selectedIds: Set<string>;
  // Per-row selection is an intent (id + checked), applied by the parent via a
  // functional state update. Rows are memoized with a comparator that ignores
  // this callback, so it must be referentially stable AND free of captured
  // selection state — otherwise a row that skips re-rendering would fire a
  // stale handler and clobber other rows' selections.
  onToggleItem: (id: string, checked: boolean) => void;
  onSelectedIdsChange: (ids: Set<string>) => void;
  onEdit: (item: WardrobeItemRow) => void;
  onDelete: (item: WardrobeItemRow) => void;
  onLogWear: (item: WardrobeItemRow) => void;
};

function stopRowNavigation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function displayValue(value: string | null | undefined) {
  return value ? value : "—";
}

function ItemThumbnail({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  if (!imageUrl) {
    return (
      <div
        className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-dashed bg-muted/30 ring-1 ring-foreground/5"
        aria-hidden
      >
        <ImageIcon className="size-5 text-muted-foreground/60" />
      </div>
    );
  }

  return (
    <div className="group/thumb relative">
      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted/30 shadow-sm ring-1 ring-foreground/10">
        <ItemImage
          src={imageUrl}
          alt={buildItemImageAltText(name, "thumbnail")}
          containerClassName="size-12"
          className="size-12 object-cover"
          fallback={
            <ImageIcon className="size-5 text-muted-foreground/60" aria-hidden />
          }
        />
      </div>
      {/* Hover preview — CSS-only, no extra state or re-renders. */}
      <div className="pointer-events-none absolute left-14 top-1/2 z-30 hidden w-48 -translate-y-1/2 overflow-hidden rounded-xl border bg-popover opacity-0 shadow-lg transition-opacity group-hover/thumb:block group-hover/thumb:opacity-100">
        <ItemImage
          src={imageUrl}
          alt={buildItemImageAltText(name, "hero")}
          containerClassName="aspect-square w-48"
          className="aspect-square w-48 object-cover"
        />
      </div>
    </div>
  );
}

function isColumnVisible(key: ColumnKey, hidden: Set<ColumnKey>): boolean {
  return !hidden.has(key);
}

type InventoryRowProps = {
  item: WardrobeItemRow;
  selected: boolean;
  columnsSignature: string;
  onToggleSelect: (id: string, checked: boolean) => void;
  onNavigate: (id: string) => void;
  onEdit: (item: WardrobeItemRow) => void;
  onDelete: (item: WardrobeItemRow) => void;
  onLogWear: (item: WardrobeItemRow) => void;
  hiddenColumns: Set<ColumnKey>;
};

const InventoryRow = memo(
  function InventoryRow({
    item,
    selected,
    onToggleSelect,
    onNavigate,
    onEdit,
    onDelete,
    onLogWear,
    hiddenColumns,
  }: InventoryRowProps) {
    return (
      <TableRow
        tabIndex={0}
        role="link"
        aria-label={`View ${item.name}`}
        data-state={selected ? "selected" : undefined}
        className={cn(
          "cursor-pointer border-b bg-card transition-colors even:bg-muted/20",
          "hover:bg-muted/50 data-[state=selected]:bg-muted/60",
          "focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        )}
        onClick={() => onNavigate(item.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onNavigate(item.id);
          }
        }}
      >
        <TableCell
          className="sticky left-0 z-10 bg-inherit"
          onClick={stopRowNavigation}
          onMouseDown={stopRowNavigation}
          onPointerDown={stopRowNavigation}
        >
          <input
            type="checkbox"
            className="size-4 rounded border"
            aria-label={`Select ${item.name}`}
            checked={selected}
            onChange={(event) => onToggleSelect(item.id, event.target.checked)}
          />
        </TableCell>
        {isColumnVisible("image", hiddenColumns) ? (
          <TableCell>
            <ItemThumbnail imageUrl={item.primary_image_url} name={item.name} />
          </TableCell>
        ) : null}
        {isColumnVisible("code", hiddenColumns) ? (
          <TableCell className="font-mono text-xs text-muted-foreground">
            {item.code}
          </TableCell>
        ) : null}
        {isColumnVisible("name", hiddenColumns) ? (
          <TableCell>
            <div>
              <p className="font-medium">{item.name}</p>
              {item.subcategory?.name && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.subcategory.name}
                </p>
              )}
            </div>
          </TableCell>
        ) : null}
        {isColumnVisible("category", hiddenColumns) ? (
          <TableCell>{displayValue(item.category?.name)}</TableCell>
        ) : null}
        {isColumnVisible("brand", hiddenColumns) ? (
          <TableCell>{displayValue(item.brand?.name)}</TableCell>
        ) : null}
        {isColumnVisible("color", hiddenColumns) ? (
          <TableCell>
            {item.primary_color?.name ? (
              <ColorSwatch
                colorName={item.primary_color.name}
                showLabel
                size="sm"
              />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
        ) : null}
        {isColumnVisible("status", hiddenColumns) ? (
          <TableCell>
            {item.status ? <StatusBadge status={item.status} /> : "—"}
          </TableCell>
        ) : null}
        {isColumnVisible("usage", hiddenColumns) ? (
          <TableCell>
            {item.usage ? <UsageBadge usage={item.usage} /> : "—"}
          </TableCell>
        ) : null}
        {isColumnVisible("rating", hiddenColumns) ? (
          <TableCell>
            <Rating value={item.rating} />
          </TableCell>
        ) : null}
        <TableCell
          className="text-right"
          onClick={stopRowNavigation}
          onMouseDown={stopRowNavigation}
          onPointerDown={stopRowNavigation}
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${item.name}`}
                  onClick={stopRowNavigation}
                  onMouseDown={stopRowNavigation}
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={stopRowNavigation}
              onMouseDown={stopRowNavigation}
            >
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <PencilIcon />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLogWear(item)}>
                <CalendarPlusIcon />
                Log wear
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={item.status === "retired"}
                onClick={() => onDelete(item)}
              >
                <ArchiveIcon />
                {item.status === "retired" ? "Already retired" : "Retire item"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  },
  // Callbacks are stable in behavior (they only call setState), so we compare
  // by data identity and the column signature to skip needless re-renders.
  (prev, next) =>
    prev.item === next.item &&
    prev.selected === next.selected &&
    prev.columnsSignature === next.columnsSignature,
);

function SortableHead({
  columnKey,
  label,
  sortRules,
  onToggleSort,
  hiddenColumns,
  className,
}: {
  columnKey: ColumnKey;
  label: string;
  sortRules: SortRule[];
  onToggleSort: InventoryTableProps["onToggleSort"];
  hiddenColumns: Set<ColumnKey>;
  className?: string;
}) {
  if (!isColumnVisible(columnKey, hiddenColumns)) {
    return null;
  }

  const column = INVENTORY_COLUMNS.find((c) => c.key === columnKey);
  const sortColumn = column?.sort;

  if (!sortColumn) {
    return <TableHead className={className}>{label}</TableHead>;
  }

  const ruleIndex = sortRules.findIndex((rule) => rule.column === sortColumn);
  const rule = ruleIndex >= 0 ? sortRules[ruleIndex] : null;

  return (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(event) => onToggleSort(sortColumn, event.shiftKey)}
      >
        {label}
        {rule ? (
          <span className="inline-flex items-center gap-0.5 text-muted-foreground">
            {rule.direction === "asc" ? (
              <ArrowUpIcon className="size-3.5" />
            ) : (
              <ArrowDownIcon className="size-3.5" />
            )}
            {sortRules.length > 1 ? (
              <span className="text-[10px] tabular-nums">{ruleIndex + 1}</span>
            ) : null}
          </span>
        ) : null}
      </button>
    </TableHead>
  );
}

export function InventoryTable({
  items,
  visibleCount,
  onLoadMore,
  hiddenColumns,
  sortRules,
  onToggleSort,
  selectedIds,
  onToggleItem,
  onSelectedIdsChange,
  onEdit,
  onDelete,
  onLogWear,
}: InventoryTableProps) {
  const router = useRouter();
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;
  const columnsSignature = [...hiddenColumns].sort().join(",");

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, visibleCount]);

  const allVisibleSelected =
    visibleItems.length > 0 &&
    visibleItems.every((item) => selectedIds.has(item.id));
  const someSelected = visibleItems.some((item) => selectedIds.has(item.id));

  function toggleAll(checked: boolean) {
    onSelectedIdsChange(
      checked ? new Set(visibleItems.map((item) => item.id)) : new Set(),
    );
  }

  function navigateToItem(itemId: string) {
    router.push(`/inventory/${itemId}`);
  }

  const stickyHead =
    "sticky top-0 z-20 bg-card [&:not(:first-child)]:z-10";

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="max-h-[calc(100vh-18rem)] min-h-40 overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(stickyHead, "sticky left-0 z-30 w-[44px]")}>
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  aria-label="Select all items"
                  checked={allVisibleSelected}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate = someSelected && !allVisibleSelected;
                    }
                  }}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </TableHead>
              {isColumnVisible("image", hiddenColumns) ? (
                <TableHead className={cn(stickyHead, "w-[68px]")}>
                  <span className="sr-only">Image</span>
                </TableHead>
              ) : null}
              <SortableHead
                columnKey="code"
                label="Code"
                sortRules={sortRules}
                onToggleSort={onToggleSort}
                hiddenColumns={hiddenColumns}
                className={cn(stickyHead, "min-w-[100px]")}
              />
              <SortableHead
                columnKey="name"
                label="Name"
                sortRules={sortRules}
                onToggleSort={onToggleSort}
                hiddenColumns={hiddenColumns}
                className={cn(stickyHead, "min-w-[180px]")}
              />
              <SortableHead
                columnKey="category"
                label="Category"
                sortRules={sortRules}
                onToggleSort={onToggleSort}
                hiddenColumns={hiddenColumns}
                className={cn(stickyHead, "min-w-[120px]")}
              />
              <SortableHead
                columnKey="brand"
                label="Brand"
                sortRules={sortRules}
                onToggleSort={onToggleSort}
                hiddenColumns={hiddenColumns}
                className={cn(stickyHead, "min-w-[120px]")}
              />
              <SortableHead
                columnKey="color"
                label="Color"
                sortRules={sortRules}
                onToggleSort={onToggleSort}
                hiddenColumns={hiddenColumns}
                className={cn(stickyHead, "min-w-[110px]")}
              />
              <SortableHead
                columnKey="status"
                label="Status"
                sortRules={sortRules}
                onToggleSort={onToggleSort}
                hiddenColumns={hiddenColumns}
                className={cn(stickyHead, "min-w-[90px]")}
              />
              <SortableHead
                columnKey="usage"
                label="Usage"
                sortRules={sortRules}
                onToggleSort={onToggleSort}
                hiddenColumns={hiddenColumns}
                className={cn(stickyHead, "min-w-[90px]")}
              />
              <SortableHead
                columnKey="rating"
                label="Rating"
                sortRules={sortRules}
                onToggleSort={onToggleSort}
                hiddenColumns={hiddenColumns}
                className={cn(stickyHead, "min-w-[90px]")}
              />
              <TableHead className={cn(stickyHead, "w-[52px] text-right")}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => (
              <InventoryRow
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                columnsSignature={columnsSignature}
                hiddenColumns={hiddenColumns}
                onToggleSelect={onToggleItem}
                onNavigate={navigateToItem}
                onEdit={onEdit}
                onDelete={onDelete}
                onLogWear={onLogWear}
              />
            ))}
            {hasMore ? (
              <tr ref={sentinelRef} aria-hidden>
                <td colSpan={INVENTORY_COLUMNS.length + 2} className="h-10">
                  <span className="flex items-center justify-center text-xs text-muted-foreground">
                    Loading more…
                  </span>
                </td>
              </tr>
            ) : null}
          </TableBody>
        </table>
      </div>
    </div>
  );
}

export function InventoryTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="space-y-0 divide-y">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex h-14 items-center gap-4 px-4">
            <div className="size-12 shrink-0 rounded-lg bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-3 w-40 rounded bg-muted" />
            <div className="hidden h-3 w-24 rounded bg-muted md:block" />
            <div className="hidden h-3 w-20 rounded bg-muted lg:block" />
            <div className="ml-auto h-6 w-16 rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
