"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  CopyIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { ReviewCleanupDialog } from "@/components/inventory/review-cleanup-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useReviewCleanupData,
  useWardrobeLookups,
} from "@/lib/wardrobe/hooks";
import { cn } from "@/lib/utils";
import {
  formatEnumLabel,
  type DuplicateGroup,
  type DuplicateMatchReason,
  type WardrobeItemRow,
} from "@/types/wardrobe";

function reasonLabel(reason: DuplicateMatchReason) {
  switch (reason) {
    case "same_code":
      return "Same code";
    case "similar_name":
      return "Similar name";
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

function ReviewItemRow({
  item,
  selected,
  onToggle,
  onEdit,
  onCleanup,
}: {
  item: WardrobeItemRow;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onEdit: () => void;
  onCleanup: () => void;
}) {
  return (
    <TableRow className={cn(selected && "bg-muted/40")}>
      <TableCell>
        <input
          type="checkbox"
          className="size-4 rounded border"
          checked={selected}
          aria-label={`Select ${item.name}`}
          onChange={(event) => onToggle(event.target.checked)}
        />
      </TableCell>
      <TableCell className="font-mono text-xs">{item.code}</TableCell>
      <TableCell>
        <Link
          href={`/inventory/${item.id}`}
          className="font-medium hover:underline"
        >
          {item.name}
        </Link>
      </TableCell>
      <TableCell>{item.category?.name ?? "—"}</TableCell>
      <TableCell>{item.brand?.name ?? "—"}</TableCell>
      <TableCell>
        {item.status ? (
          <Badge variant={item.status === "retired" ? "outline" : "secondary"}>
            {formatEnumLabel(item.status)}
          </Badge>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit}>
            <PencilIcon />
            <span className="sr-only">Edit {item.name}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCleanup}
            disabled={item.status === "retired"}
          >
            <Trash2Icon />
            <span className="sr-only">Clean up {item.name}</span>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function DuplicateGroupCard({
  group,
  selectedIds,
  onToggleItem,
  onToggleGroup,
  onEditItem,
  onCleanupItem,
}: {
  group: DuplicateGroup;
  selectedIds: Set<string>;
  onToggleItem: (itemId: string, checked: boolean) => void;
  onToggleGroup: (checked: boolean) => void;
  onEditItem: (item: WardrobeItemRow) => void;
  onCleanupItem: (item: WardrobeItemRow) => void;
}) {
  const groupIds = group.items.map((item) => item.id);
  const selectedInGroup = groupIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = selectedInGroup === groupIds.length && groupIds.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CopyIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">{group.label}</CardTitle>
              <Badge variant="outline">{reasonLabel(group.reason)}</Badge>
            </div>
            <CardDescription>
              {group.items.length} possible duplicate
              {group.items.length === 1 ? "" : "s"}
            </CardDescription>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border"
              checked={allSelected}
              onChange={(event) => onToggleGroup(event.target.checked)}
            />
            Select group
          </label>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px]" />
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.items.map((item) => (
              <ReviewItemRow
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                onToggle={(checked) => onToggleItem(item.id, checked)}
                onEdit={() => onEditItem(item)}
                onCleanup={() => onCleanupItem(item)}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function InventoryReviewView() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupIds, setCleanupIds] = useState<string[]>([]);
  const [cleanupLabel, setCleanupLabel] = useState<string | undefined>();
  const [editItem, setEditItem] = useState<WardrobeItemRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const reviewQuery = useReviewCleanupData();
  const lookupsQuery = useWardrobeLookups();

  const allItems = useMemo(() => {
    const items = new Map<string, WardrobeItemRow>();
    for (const group of reviewQuery.data?.groups ?? []) {
      for (const item of group.items) {
        items.set(item.id, item);
      }
    }
    return Array.from(items.values());
  }, [reviewQuery.data?.groups]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return allItems;
    }
    return allItems.filter(
      (item) =>
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.brand?.name.toLowerCase().includes(query) ||
        item.category?.name.toLowerCase().includes(query),
    );
  }, [allItems, search]);

  function toggleSelection(itemId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  }

  function toggleGroupSelection(itemIds: string[], checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of itemIds) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }

  function openCleanup(ids: string[], label?: string) {
    setCleanupIds(ids);
    setCleanupLabel(label);
    setCleanupOpen(true);
  }

  function openEdit(item: WardrobeItemRow) {
    setEditItem(item);
    setEditOpen(true);
  }

  function handleCleanupCompleted() {
    setSelectedIds(new Set());
    setCleanupIds([]);
    setCleanupLabel(undefined);
    void reviewQuery.refetch();
  }

  const selectedCount = selectedIds.size;

  if (reviewQuery.isPending || lookupsQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-6 py-8 lg:px-8 lg:py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (reviewQuery.error) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-6 py-8 lg:px-8 lg:py-10">
        <InventoryErrorState
          message={reviewQuery.error.message}
          onRetry={() => reviewQuery.refetch()}
          isRetrying={reviewQuery.isFetching}
        />
      </div>
    );
  }

  const review = reviewQuery.data;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-6 py-8 pb-28 lg:px-8 lg:py-10">
      <header className="space-y-4 border-b pb-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" render={<Link href="/inventory" />}>
            <ArrowLeftIcon />
            Inventory
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/inventory/import" />}>
            Import
          </Button>
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Import review</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Find duplicate or test items after import, fix metadata quickly, and
            clean up in bulk. Default cleanup retires items; hard delete requires
            explicit confirmation.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total catalog items</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {review?.totalItems ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Duplicate groups</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {review?.groups.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Items in duplicate groups</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {review?.duplicateItemCount ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Possible duplicates</h2>
            <p className="text-sm text-muted-foreground">
              Matched by same code (case-insensitive) or similar item name.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by code, name, brand…"
              className="pl-9"
            />
          </div>
        </div>

        {review?.groups.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No duplicate groups detected. Your catalog looks clean.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {review?.groups
              .map((group) => ({
                ...group,
                items: group.items.filter((item) =>
                  filteredItems.some((filtered) => filtered.id === item.id),
                ),
              }))
              .filter((group) => group.items.length > 0)
              .map((group) => (
              <DuplicateGroupCard
                key={group.id}
                group={group}
                selectedIds={selectedIds}
                onToggleItem={toggleSelection}
                onToggleGroup={(checked) =>
                  toggleGroupSelection(
                    group.items.map((item) => item.id),
                    checked,
                  )
                }
                onEditItem={openEdit}
                onCleanupItem={(item) => openCleanup([item.id], item.name)}
              />
            ))}
          </div>
        )}
      </section>

      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4 lg:px-8">
            <p className="text-sm font-medium">
              {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedIds(new Set())}>
                Clear selection
              </Button>
              <Button
                onClick={() =>
                  openCleanup(Array.from(selectedIds), `${selectedCount} selected items`)
                }
              >
                <Trash2Icon />
                Clean up selected
              </Button>
            </div>
          </div>
        </div>
      )}

      <ReviewCleanupDialog
        open={cleanupOpen}
        itemIds={cleanupIds}
        itemLabel={cleanupLabel}
        onOpenChange={setCleanupOpen}
        onCompleted={handleCleanupCompleted}
      />

      <ItemFormDialog
        mode="edit"
        open={editOpen}
        item={editItem}
        lookups={
          lookupsQuery.data ?? {
            categories: [],
            subcategories: [],
            brands: [],
            colors: [],
          }
        }
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditItem(null);
            void reviewQuery.refetch();
          }
        }}
      />
    </div>
  );
}
