"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RefreshCwIcon, ShirtIcon } from "lucide-react";

import { SpendingChart } from "@/components/purchases/spending-chart";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
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
import {
  usePurchaseCharts,
  usePurchases,
  useWardrobeLookups,
} from "@/lib/wardrobe/hooks";
import { formatPurchaseDisplayDate } from "@/lib/wardrobe/purchases";
import {
  formatCurrency,
  formatEnumLabel,
  PURCHASE_STATUSES,
  UNCATEGORIZED_CATEGORY_ID,
  type PurchaseFilters,
} from "@/types/wardrobe";

const YEAR_OPTIONS = Array.from({ length: 8 }, (_, index) =>
  String(new Date().getFullYear() - index),
);

export function PurchasesView() {
  const [year, setYear] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const filters = useMemo<PurchaseFilters>(() => {
    const parsedMin = priceMin.trim() ? Number(priceMin) : undefined;
    const parsedMax = priceMax.trim() ? Number(priceMax) : undefined;

    return {
      year: year || undefined,
      brandId: brandId || undefined,
      categoryId: categoryId || undefined,
      status: status || undefined,
      priceMin:
        parsedMin !== undefined && !Number.isNaN(parsedMin)
          ? parsedMin
          : undefined,
      priceMax:
        parsedMax !== undefined && !Number.isNaN(parsedMax)
          ? parsedMax
          : undefined,
    };
  }, [year, brandId, categoryId, status, priceMin, priceMax]);

  const purchasesQuery = usePurchases(filters);
  const chartsQuery = usePurchaseCharts(filters);
  const lookupsQuery = useWardrobeLookups();

  const purchases = purchasesQuery.data ?? [];
  const charts = chartsQuery.data ?? {
    monthly: [],
    byBrand: [],
    byCategory: [],
  };
  const lookups = lookupsQuery.data ?? {
    categories: [],
    subcategories: [],
    brands: [],
    colors: [],
  };

  const selectedBrandName =
    lookups.brands.find((brand) => brand.id === brandId)?.name ?? null;
  const selectedCategoryName =
    categoryId === UNCATEGORIZED_CATEGORY_ID
      ? "Uncategorized"
      : (lookups.categories.find((category) => category.id === categoryId)
          ?.name ?? null);

  function clearFilters() {
    setYear("");
    setBrandId("");
    setCategoryId("");
    setStatus("");
    setPriceMin("");
    setPriceMax("");
  }

  const hasFilters = Boolean(
    year || brandId || categoryId || status || priceMin || priceMax,
  );

  function handleRetry() {
    void Promise.all([purchasesQuery.refetch(), chartsQuery.refetch()]);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Purchase history
            </h1>
            {!purchasesQuery.isPending && !purchasesQuery.error ? (
              <Badge variant="secondary" className="tabular-nums">
                {purchases.length} purchases
              </Badge>
            ) : null}
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Track spending, filter purchase records, and review cost patterns
            across your wardrobe.
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
            disabled={purchasesQuery.isFetching || chartsQuery.isFetching}
          >
            <RefreshCwIcon
              className={
                purchasesQuery.isFetching || chartsQuery.isFetching
                  ? "animate-spin"
                  : undefined
              }
            />
            Refresh
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter purchases by year, brand, category, status, or price range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Select
                value={year}
                onValueChange={(value) => setYear(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <span
                    className={
                      year
                        ? "flex flex-1 truncate text-left"
                        : "flex flex-1 truncate text-left text-muted-foreground"
                    }
                  >
                    {year || "All years"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All years</SelectItem>
                  {YEAR_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select
                value={brandId}
                onValueChange={(value) => setBrandId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <span
                    className={
                      selectedBrandName
                        ? "flex flex-1 truncate text-left"
                        : "flex flex-1 truncate text-left text-muted-foreground"
                    }
                  >
                    {selectedBrandName ?? "All brands"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All brands</SelectItem>
                  {lookups.brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
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
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <span
                    className={
                      status
                        ? "flex flex-1 truncate text-left"
                        : "flex flex-1 truncate text-left text-muted-foreground"
                    }
                  >
                    {status ? formatEnumLabel(status) : "All statuses"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  {PURCHASE_STATUSES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {formatEnumLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price-min">Min price</Label>
              <Input
                id="price-min"
                type="number"
                min={0}
                step={0.01}
                value={priceMin}
                onChange={(event) => setPriceMin(event.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price-max">Max price</Label>
              <Input
                id="price-max"
                type="number"
                min={0}
                step={0.01}
                value={priceMax}
                onChange={(event) => setPriceMax(event.target.value)}
                placeholder="Any"
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

      {purchasesQuery.error ? (
        <InventoryErrorState
          message={purchasesQuery.error.message}
          onRetry={handleRetry}
          isRetrying={purchasesQuery.isFetching}
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <SpendingChart
              title="Monthly spending"
              description="Filtered purchase totals by month."
              items={charts.monthly.map((entry) => ({
                id: entry.month,
                name: entry.label,
                amount: entry.amount,
              }))}
            />
            <SpendingChart
              title="Brand spending"
              description="Filtered totals grouped by brand."
              items={charts.byBrand}
            />
            <SpendingChart
              title="Category spending"
              description="Filtered totals grouped by category."
              items={charts.byCategory}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Purchase records</CardTitle>
              <CardDescription>
                Detailed purchase history for filtered results.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Date</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchasesQuery.isPending ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-10 text-center text-muted-foreground"
                        >
                          Loading purchases…
                        </TableCell>
                      </TableRow>
                    ) : purchases.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-10 text-center text-muted-foreground"
                        >
                          No purchases match these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchases.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell className="whitespace-nowrap tabular-nums">
                            {formatPurchaseDisplayDate(purchase.purchase_date)}
                          </TableCell>
                          <TableCell>
                            {purchase.item ? (
                              <Link
                                href={`/inventory/${purchase.item.id}`}
                                className="font-medium hover:underline"
                              >
                                {purchase.item.name}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {purchase.item?.brand?.name ?? "—"}
                          </TableCell>
                          <TableCell>
                            {purchase.item?.category?.name ?? "—"}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatCurrency(Number(purchase.price))}
                          </TableCell>
                          <TableCell>{purchase.source?.trim() || "—"}</TableCell>
                          <TableCell>
                            {purchase.status
                              ? formatEnumLabel(String(purchase.status))
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
