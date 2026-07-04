"use client";

import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";

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
import { formatEnumLabel, type WardrobeItemRow } from "@/types/wardrobe";

type InventoryTableProps = {
  items: WardrobeItemRow[];
  onEdit: (item: WardrobeItemRow) => void;
  onDelete: (item: WardrobeItemRow) => void;
};

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}

function EnumCell({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span>{formatEnumLabel(value)}</span>;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function InventoryTable({
  items,
  onEdit,
  onDelete,
}: InventoryTableProps) {
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-card">Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Category</TableHead>
            <TableHead className="hidden lg:table-cell">Subcategory</TableHead>
            <TableHead className="hidden lg:table-cell">Brand</TableHead>
            <TableHead className="hidden xl:table-cell">Color</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Rating</TableHead>
            <TableHead className="hidden xl:table-cell">Usage</TableHead>
            <TableHead className="hidden 2xl:table-cell">Added</TableHead>
            <TableHead className="w-[52px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="sticky left-0 z-10 bg-card font-mono text-xs">
                {item.code}
              </TableCell>
              <TableCell>
                <div className="min-w-[140px]">
                  <p className="font-medium">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground md:hidden">
                    {[item.category?.name, item.brand?.name]
                      .filter(Boolean)
                      .join(" · ") || "Uncategorized"}
                  </p>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {displayValue(item.category?.name)}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {displayValue(item.subcategory?.name)}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {displayValue(item.brand?.name)}
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                {displayValue(item.primary_color?.name)}
              </TableCell>
              <TableCell>
                {item.status ? (
                  <Badge variant="secondary">
                    {formatEnumLabel(item.status)}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="hidden sm:table-cell tabular-nums">
                {displayValue(item.rating)}
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                <EnumCell value={item.usage} />
              </TableCell>
              <TableCell className="hidden 2xl:table-cell text-muted-foreground">
                {formatDate(item.created_at)}
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
                      onClick={() => onDelete(item)}
                    >
                      <Trash2Icon />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
