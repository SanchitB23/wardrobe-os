"use client";

import { ArchiveIcon, MoreHorizontalIcon, PencilIcon, StarIcon } from "lucide-react";

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
  onEdit: (item: WardrobeItemRow) => void;
  onDelete: (item: WardrobeItemRow) => void;
};

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

export function InventoryTable({
  items,
  onEdit,
  onDelete,
}: InventoryTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
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
              <TableRow key={item.id}>
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
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${item.name}`}
                        />
                      }
                    >
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(item)}>
                        <PencilIcon />
                        Edit
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
