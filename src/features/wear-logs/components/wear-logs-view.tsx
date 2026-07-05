"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RefreshCwIcon, ShirtIcon, Trash2Icon } from "lucide-react";

import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteWearLogDialog } from "@/features/wear-logs/components/delete-wear-log-dialog";
import { useOccasions, useWearLogs } from "@/features/wear-logs/hooks";
import { formatWearLogDisplayDate } from "@/features/wear-logs/services/wear-logs.service";
import type { WearLogFilters, WearLogListRow } from "@/features/wear-logs/types";
import {
  useWardrobeItems,
  useWardrobeLookups,
} from "@/features/inventory/hooks";
import {
  formatRating,
  UNCATEGORIZED_CATEGORY_ID,
} from "@/types/wardrobe";

export function WearLogsView() {
  const [itemId, setItemId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [occasionId, setOccasionId] = useState<string>("");
  const [wornFrom, setWornFrom] = useState("");
  const [wornTo, setWornTo] = useState("");
  const [logToDelete, setLogToDelete] = useState<WearLogListRow | null>(null);

  const filters = useMemo<WearLogFilters>(
    () => ({
      itemId: itemId || undefined,
      categoryId: categoryId || undefined,
      occasionId: occasionId || undefined,
      wornFrom: wornFrom || undefined,
      wornTo: wornTo || undefined,
    }),
    [itemId, categoryId, occasionId, wornFrom, wornTo],
  );

  const wearLogsQuery = useWearLogs(filters);
  const itemsQuery = useWardrobeItems({});
  const lookupsQuery = useWardrobeLookups();
  const occasionsQuery = useOccasions();

  const logs = wearLogsQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const lookups = lookupsQuery.data ?? {
    categories: [],
    subcategories: [],
    brands: [],
    colors: [],
  };
  const occasions = occasionsQuery.data ?? [];

  const selectedItemName =
    items.find((item) => item.id === itemId)?.name ?? null;
  const selectedCategoryName =
    categoryId === UNCATEGORIZED_CATEGORY_ID
      ? "Uncategorized"
      : (lookups.categories.find((category) => category.id === categoryId)
          ?.name ?? null);
  const selectedOccasionName =
    occasions.find((occasion) => occasion.id === occasionId)?.name ?? null;

  function handleRetry() {
    void wearLogsQuery.refetch();
  }

  function clearFilters() {
    setItemId("");
    setCategoryId("");
    setOccasionId("");
    setWornFrom("");
    setWornTo("");
  }

  const hasFilters = Boolean(
    itemId || categoryId || occasionId || wornFrom || wornTo,
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Wear logs</h1>
            {!wearLogsQuery.isPending && !wearLogsQuery.error ? (
              <Badge variant="secondary" className="tabular-nums">
                {logs.length} entries
              </Badge>
            ) : null}
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Track when items were worn, filter by item or occasion, and manage
            your wear history.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/inventory" />}>
            <ShirtIcon />
            Inventory
          </Button>
          <Button
            variant="outline"
            onClick={handleRetry}
            disabled={wearLogsQuery.isFetching}
          >
            <RefreshCwIcon
              className={wearLogsQuery.isFetching ? "animate-spin" : undefined}
            />
            Refresh
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow wear logs by item, category, occasion, or date.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5">
              <Label>Item</Label>
              <Select
                value={itemId}
                onValueChange={(value) => setItemId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <span
                    className={
                      selectedItemName
                        ? "flex flex-1 truncate text-left"
                        : "flex flex-1 truncate text-left text-muted-foreground"
                    }
                  >
                    {selectedItemName ?? "All items"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All items</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={categoryId}
                onValueChange={(value) => setCategoryId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <span
                    className={
                      selectedCategoryName
                        ? "flex flex-1 truncate text-left"
                        : "flex flex-1 truncate text-left text-muted-foreground"
                    }
                  >
                    {selectedCategoryName ?? "All categories"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  <SelectItem value={UNCATEGORIZED_CATEGORY_ID}>
                    Uncategorized
                  </SelectItem>
                  {lookups.categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Occasion</Label>
              <Select
                value={occasionId}
                onValueChange={(value) => setOccasionId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <span
                    className={
                      selectedOccasionName
                        ? "flex flex-1 truncate text-left"
                        : "flex flex-1 truncate text-left text-muted-foreground"
                    }
                  >
                    {selectedOccasionName ?? "All occasions"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All occasions</SelectItem>
                  {occasions.map((occasion) => (
                    <SelectItem key={occasion.id} value={occasion.id}>
                      {occasion.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wear-from">From</Label>
              <Input
                id="wear-from"
                type="date"
                value={wornFrom}
                onChange={(event) => setWornFrom(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wear-to">To</Label>
              <Input
                id="wear-to"
                type="date"
                value={wornTo}
                onChange={(event) => setWornTo(event.target.value)}
              />
            </div>
          </div>

          {hasFilters ? (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {wearLogsQuery.error ? (
        <InventoryErrorState
          message={wearLogsQuery.error.message}
          onRetry={handleRetry}
          isRetrying={wearLogsQuery.isFetching}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Wear history</CardTitle>
            <CardDescription>
              Most recent wears appear first.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Occasion</TableHead>
                    <TableHead>Comfort</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[52px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wearLogsQuery.isPending ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        Loading wear logs…
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        No wear logs match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {formatWearLogDisplayDate(log.worn_on)}
                        </TableCell>
                        <TableCell>
                          {log.item ? (
                            <Link
                              href={`/inventory/${log.item.id}`}
                              className="font-medium hover:underline"
                            >
                              {log.item.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{log.item?.category?.name ?? "—"}</TableCell>
                        <TableCell>{log.occasion?.name ?? "—"}</TableCell>
                        <TableCell className="tabular-nums">
                          {log.comfort_rating !== null
                            ? `${formatRating(log.comfort_rating)}/10`
                            : "—"}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">
                          {log.notes?.trim() || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete wear log for ${log.item?.name ?? "item"}`}
                            onClick={() => setLogToDelete(log)}
                          >
                            <Trash2Icon />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <DeleteWearLogDialog
        log={logToDelete}
        open={logToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLogToDelete(null);
          }
        }}
      />
    </div>
  );
}
