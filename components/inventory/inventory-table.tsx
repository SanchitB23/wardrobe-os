"use client";

import { useRouter } from "next/navigation";
import { ArchiveIcon, CalendarPlusIcon, ImageIcon, MoreHorizontalIcon, PencilIcon, StarIcon } from "lucide-react";

import { ItemImage } from "@/components/inventory/item-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildItemImageAltText } from "@/lib/wardrobe/images";
import { cn } from "@/lib/utils";
import {
  formatEnumLabel,
  formatRating,
  type ItemStatus,
  type UsageFrequency,
  type WardrobeItemRow,
} from "@/types/wardrobe";

type InventoryTableProps = {
  items: WardrobeItemRow[];
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  onEdit: (item: WardrobeItemRow) => void;
  onDelete: (item: WardrobeItemRow) => void;
  onLogWear: (item: WardrobeItemRow) => void;
};

function stopRowNavigation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function statusBadgeVariant(
  status: ItemStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "retired":
      return "outline";
    case "returned":
      return "destructive";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function usageBadgeVariant(
  usage: UsageFrequency,
): "default" | "secondary" | "outline" {
  switch (usage) {
    case "hero":
      return "default";
    case "frequent":
      return "secondary";
    case "regular":
    case "occasional":
    case "rare":
      return "outline";
    default: {
      const _exhaustive: never = usage;
      return _exhaustive;
    }
  }
}

function displayValue(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  return value;
}

function RatingCell({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="inline-flex items-center gap-1 tabular-nums">
      <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
      <span className="font-medium">{formatRating(rating)}</span>
      <span className="text-xs text-muted-foreground">/10</span>
    </div>
  );
}

function ColorBadge({ name }: { name: string | null | undefined }) {
  if (!name) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Badge variant="outline" className="font-normal">
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full border border-foreground/10 bg-muted",
        )}
      />
      {name}
    </Badge>
  );
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
    <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted/30 shadow-sm ring-1 ring-foreground/10">
      <ItemImage
        src={imageUrl}
        alt={buildItemImageAltText(name, "thumbnail")}
        containerClassName="size-12"
        className="size-12 object-cover"
        fallback={<ImageIcon className="size-5 text-muted-foreground/60" aria-hidden />}
      />
    </div>
  );
}

export function InventoryTable({
  items,
  selectedIds,
  onSelectedIdsChange,
  onEdit,
  onDelete,
  onLogWear,
}: InventoryTableProps) {
  const router = useRouter();

  const allSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const someSelected = items.some((item) => selectedIds.has(item.id));

  function toggleItem(itemId: string, checked: boolean) {
    onSelectedIdsChange(
      new Set(
        checked
          ? [...selectedIds, itemId]
          : [...selectedIds].filter((id) => id !== itemId),
      ),
    );
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      onSelectedIdsChange(new Set(items.map((item) => item.id)));
      return;
    }
    onSelectedIdsChange(new Set());
  }

  function navigateToItem(itemId: string) {
    router.push(`/inventory/${itemId}`);
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[44px]">
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  aria-label="Select all items"
                  checked={allSelected}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate = someSelected && !allSelected;
                    }
                  }}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </TableHead>
              <TableHead className="w-[68px]">
                <span className="sr-only">Image</span>
              </TableHead>
              <TableHead className="min-w-[100px]">Code</TableHead>
              <TableHead className="min-w-[180px]">Name</TableHead>
              <TableHead className="min-w-[120px]">Category</TableHead>
              <TableHead className="min-w-[120px]">Brand</TableHead>
              <TableHead className="min-w-[110px]">Color</TableHead>
              <TableHead className="min-w-[90px]">Status</TableHead>
              <TableHead className="min-w-[90px]">Usage</TableHead>
              <TableHead className="min-w-[90px]">Rating</TableHead>
              <TableHead className="w-[52px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                tabIndex={0}
                role="link"
                aria-label={`View ${item.name}`}
                className={cn(
                  "cursor-pointer transition-colors",
                  selectedIds.has(item.id) && "bg-muted/40",
                  "hover:bg-muted/60",
                  "focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                )}
                onClick={() => navigateToItem(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigateToItem(item.id);
                  }
                }}
              >
                <TableCell
                  onClick={stopRowNavigation}
                  onMouseDown={stopRowNavigation}
                  onPointerDown={stopRowNavigation}
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border"
                    aria-label={`Select ${item.name}`}
                    checked={selectedIds.has(item.id)}
                    onChange={(event) =>
                      toggleItem(item.id, event.target.checked)
                    }
                  />
                </TableCell>
                <TableCell>
                  <ItemThumbnail
                    imageUrl={item.primary_image_url}
                    name={item.name}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {item.code}
                </TableCell>
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
                <TableCell>{displayValue(item.category?.name)}</TableCell>
                <TableCell>{displayValue(item.brand?.name)}</TableCell>
                <TableCell>
                  <ColorBadge name={item.primary_color?.name} />
                </TableCell>
                <TableCell>
                  {item.status ? (
                    <Badge variant={statusBadgeVariant(item.status)}>
                      {formatEnumLabel(item.status)}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {item.usage ? (
                    <Badge variant={usageBadgeVariant(item.usage)}>
                      {formatEnumLabel(item.usage)}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <RatingCell rating={item.rating} />
                </TableCell>
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
            ))}
          </TableBody>
        </Table>
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
