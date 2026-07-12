"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  EyeOffIcon,
  ImagePlusIcon,
  PencilIcon,
  ScanSearchIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

import { PageHeader } from "@/features/layout";
import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { ItemFormDialog } from "@/features/inventory/components/item-form-dialog";
import { ReviewCleanupDialog } from "@/features/inventory/components/review-cleanup-dialog";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useCatalogReviewData,
  useDismissCatalogPairMutation,
  useMarkCatalogReviewedMutation,
  useWardrobeLookups,
} from "@/features/inventory/hooks";
import { formatSimilarReason } from "@/features/inventory/lib/similar-reason-labels";
import { cn } from "@/lib/utils";
import { formatEnumLabel, type WardrobeItemRow } from "@/types/wardrobe";

type SectionKey =
  | "duplicates"
  | "similar"
  | "missing_metadata"
  | "unbranded"
  | "missing_images"
  | "visual_pending"
  | "data_quality";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "duplicates", label: "Duplicates" },
  { key: "similar", label: "Similar Items" },
  { key: "missing_metadata", label: "Missing Metadata" },
  { key: "unbranded", label: "Unbranded" },
  { key: "missing_images", label: "Missing Images" },
  { key: "visual_pending", label: "Visual Analysis Pending" },
  { key: "data_quality", label: "Data Quality Issues" },
];

function ReviewItemRow({
  item,
  selected,
  onToggle,
  onEdit,
  onCleanup,
  onMarkReviewed,
  onAnalyze,
}: {
  item: WardrobeItemRow;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onEdit: () => void;
  onCleanup: () => void;
  onMarkReviewed: () => void;
  onAnalyze: () => void;
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
      <TableCell>{item.primary_color?.name ?? "—"}</TableCell>
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
        <div className="flex justify-end gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit"
                  onClick={onEdit}
                />
              }
            >
              <PencilIcon />
            </TooltipTrigger>
            <TooltipContent>Edit item</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Add or manage image"
                  render={<Link href={`/inventory/${item.id}`} />}
                />
              }
            >
              <ImagePlusIcon />
            </TooltipTrigger>
            <TooltipContent>Add image</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Analyze visual attributes"
                  onClick={onAnalyze}
                />
              }
            >
              <ScanSearchIcon />
            </TooltipTrigger>
            <TooltipContent>Analyze visual attributes</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Mark reviewed"
                  onClick={onMarkReviewed}
                />
              }
            >
              <CheckIcon />
            </TooltipTrigger>
            <TooltipContent>Mark reviewed</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clean up"
                onClick={onCleanup}
                disabled={item.status === "retired"}
              >
                <Trash2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {item.status === "retired" ? "Already retired" : "Clean up"}
            </TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function InventoryReviewView() {
  const [includeRetired, setIncludeRetired] = useState(false);
  const [hideReviewed, setHideReviewed] = useState(false);
  const [section, setSection] = useState<SectionKey>("duplicates");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cleanupIds, setCleanupIds] = useState<string[]>([]);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [editItem, setEditItem] = useState<WardrobeItemRow | null>(null);

  const reviewQuery = useCatalogReviewData({
    includeRetired,
    hideReviewedIssues: hideReviewed,
  });
  const lookupsQuery = useWardrobeLookups();
  const dismissMutation = useDismissCatalogPairMutation();
  const reviewedMutation = useMarkCatalogReviewedMutation();

  const review = reviewQuery.data;

  const matchesSearch = (item: WardrobeItemRow) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.brand?.name ?? "").toLowerCase().includes(q) ||
      (item.category?.name ?? "").toLowerCase().includes(q) ||
      (item.primary_color?.name ?? "").toLowerCase().includes(q)
    );
  };

  const itemById = review?.itemById;

  const sectionCounts = useMemo(() => {
    if (!review) {
      return {
        duplicates: 0,
        similar: 0,
        missing_metadata: 0,
        unbranded: 0,
        missing_images: 0,
        visual_pending: 0,
        data_quality: 0,
      };
    }
    return {
      duplicates: review.duplicates.length,
      similar: review.similar.length,
      missing_metadata: review.missingMetadata.length,
      unbranded: review.unbranded.length,
      missing_images: review.missingImages.length,
      visual_pending: review.visualPending.length,
      data_quality: review.dataQuality.length,
    };
  }, [review]);

  function toggleId(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openCleanup(ids: string[]) {
    setCleanupIds(ids);
    setCleanupOpen(true);
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

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-6 py-8 lg:px-8 lg:py-10">
      <PageHeader
        className="border-b pb-6"
        title="Catalog Review"
        description="Wardrobe data quality — metadata-aware duplicates, similar items, and completeness. Default cleanup retires items; hard delete requires explicit confirmation. AI never decides catalog correctness."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Catalog quality</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {review?.qualityScore ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active items</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {review?.totalActive ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Duplicate groups</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {sectionCounts.duplicates}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open issues</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {sectionCounts.missing_metadata +
                sectionCounts.unbranded +
                sectionCounts.missing_images +
                sectionCounts.visual_pending +
                sectionCounts.data_quality}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="relative min-w-[14rem] flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by code, name, brand, color…"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={includeRetired}
            onChange={(e) => setIncludeRetired(e.target.checked)}
          />
          Include retired
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={hideReviewed}
            onChange={(e) => setHideReviewed(e.target.checked)}
          />
          Hide reviewed issues
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant={section === s.key ? "default" : "outline"}
            onClick={() => setSection(s.key)}
          >
            {s.label}
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {sectionCounts[s.key]}
            </Badge>
          </Button>
        ))}
      </div>

      {section === "duplicates" ? (
        <SectionCard
          title="Duplicate groups"
          description="Same code, or same name + category + color. Fuzzy name alone is never a duplicate."
          empty={sectionCounts.duplicates === 0}
          emptyLabel="No duplicate groups."
        >
          {review?.duplicates.map((group) => {
            const items = group.itemIds
              .map((id) => itemById?.get(id))
              .filter((i): i is WardrobeItemRow => Boolean(i))
              .filter(matchesSearch);
            if (items.length === 0) return null;
            const allSelected = items.every((i) => selectedIds.has(i.id));
            return (
              <Card key={group.id} className="mb-4">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CopyIcon className="size-4 text-muted-foreground" />
                        <CardTitle className="text-base">
                          {group.label}
                        </CardTitle>
                        <Badge variant="outline">
                          {group.reason === "same_code"
                            ? "Same code"
                            : "Same identity"}
                        </Badge>
                      </div>
                      <CardDescription>
                        {items.length} possible duplicate
                        {items.length === 1 ? "" : "s"}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={allSelected}
                          onChange={(e) => {
                            for (const item of items) {
                              toggleId(item.id, e.target.checked);
                            }
                          }}
                        />
                        Select group
                      </label>
                      {items.length >= 2 ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={dismissMutation.isPending}
                          onClick={() =>
                            dismissMutation.mutate({
                              itemIdA: items[0].id,
                              itemIdB: items[1].id,
                              kind: "duplicate",
                            })
                          }
                        >
                          <EyeOffIcon className="size-4" />
                          Dismiss
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ItemTable
                    items={items}
                    selectedIds={selectedIds}
                    onToggle={toggleId}
                    onEdit={setEditItem}
                    onCleanup={(id) => openCleanup([id])}
                    onMarkReviewed={(id) => reviewedMutation.mutate(id)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </SectionCard>
      ) : null}

      {section === "similar" ? (
        <SectionCard
          title="Similar items"
          description="Similar garment names with different color, brand, or category — not duplicates."
          empty={sectionCounts.similar === 0}
          emptyLabel="No similar pairs."
        >
          {review?.similar.map((pair) => {
            const a = itemById?.get(pair.itemIdA);
            const b = itemById?.get(pair.itemIdB);
            if (!a || !b) return null;
            if (!matchesSearch(a) && !matchesSearch(b)) return null;
            return (
              <Card key={pair.id} className="mb-4">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{pair.label}</CardTitle>
                      <CardDescription>
                        {formatSimilarReason(pair.reason)}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={dismissMutation.isPending}
                      onClick={() =>
                        dismissMutation.mutate({
                          itemIdA: pair.itemIdA,
                          itemIdB: pair.itemIdB,
                          kind: "similar",
                        })
                      }
                    >
                      <EyeOffIcon className="size-4" />
                      Dismiss
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ItemTable
                    items={[a, b]}
                    selectedIds={selectedIds}
                    onToggle={toggleId}
                    onEdit={setEditItem}
                    onCleanup={(id) => openCleanup([id])}
                    onMarkReviewed={(id) => reviewedMutation.mutate(id)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </SectionCard>
      ) : null}

      {section === "missing_metadata" ||
      section === "unbranded" ||
      section === "missing_images" ||
      section === "visual_pending" ||
      section === "data_quality" ? (
        <IssueSection
          section={section}
          review={review}
          itemById={itemById}
          matchesSearch={matchesSearch}
          selectedIds={selectedIds}
          onToggle={toggleId}
          onEdit={setEditItem}
          onCleanup={(id) => openCleanup([id])}
          onMarkReviewed={(id) => reviewedMutation.mutate(id)}
        />
      ) : null}

      {selectedCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-6 py-3">
            <p className="text-sm font-medium">
              {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </Button>
              <Button onClick={() => openCleanup([...selectedIds])}>
                <Trash2Icon />
                Clean up selected
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ReviewCleanupDialog
        open={cleanupOpen}
        itemIds={cleanupIds}
        onOpenChange={(open) => {
          setCleanupOpen(open);
          if (!open) setCleanupIds([]);
        }}
        onCompleted={() => {
          setSelectedIds(new Set());
          void reviewQuery.refetch();
        }}
      />

      {lookupsQuery.data ? (
        <ItemFormDialog
          mode="edit"
          item={editItem}
          open={editItem != null}
          lookups={lookupsQuery.data}
          onOpenChange={(open) => {
            if (!open) {
              setEditItem(null);
              void reviewQuery.refetch();
            }
          }}
        />
      ) : null}
    </div>
  );
}

function SectionCard({
  title,
  description,
  empty,
  emptyLabel,
  children,
}: {
  title: string;
  description: string;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {empty ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </CardContent>
        </Card>
      ) : (
        children
      )}
    </section>
  );
}

function ItemTable({
  items,
  selectedIds,
  onToggle,
  onEdit,
  onCleanup,
  onMarkReviewed,
}: {
  items: WardrobeItemRow[];
  selectedIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onEdit: (item: WardrobeItemRow) => void;
  onCleanup: (id: string) => void;
  onMarkReviewed: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Color</TableHead>
          <TableHead>Brand</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <ReviewItemRow
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            onToggle={(checked) => onToggle(item.id, checked)}
            onEdit={() => onEdit(item)}
            onCleanup={() => onCleanup(item.id)}
            onMarkReviewed={() => onMarkReviewed(item.id)}
            onAnalyze={() => {
              window.location.href = `/inventory/${item.id}`;
            }}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function IssueSection({
  section,
  review,
  itemById,
  matchesSearch,
  selectedIds,
  onToggle,
  onEdit,
  onCleanup,
  onMarkReviewed,
}: {
  section: SectionKey;
  review: ReturnType<typeof useCatalogReviewData>["data"];
  itemById: Map<string, WardrobeItemRow> | undefined;
  matchesSearch: (item: WardrobeItemRow) => boolean;
  selectedIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onEdit: (item: WardrobeItemRow) => void;
  onCleanup: (id: string) => void;
  onMarkReviewed: (id: string) => void;
}) {
  const issues =
    section === "missing_metadata"
      ? review?.missingMetadata
      : section === "unbranded"
        ? review?.unbranded
        : section === "missing_images"
          ? review?.missingImages
          : section === "visual_pending"
            ? review?.visualPending
            : review?.dataQuality;

  const byItem = new Map<string, string[]>();
  for (const iss of issues ?? []) {
    const labels = byItem.get(iss.itemId) ?? [];
    labels.push(iss.label);
    byItem.set(iss.itemId, labels);
  }

  const items = [...byItem.keys()]
    .map((id) => itemById?.get(id))
    .filter((i): i is WardrobeItemRow => Boolean(i))
    .filter(matchesSearch);

  const title = SECTIONS.find((s) => s.key === section)?.label ?? "Issues";

  return (
    <SectionCard
      title={title}
      description="Deterministic completeness checks. Edit metadata or open the item to add images / run visual analysis."
      empty={items.length === 0}
      emptyLabel="Nothing in this section."
    >
      <Card>
        <CardContent className="pt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {[...byItem.entries()].slice(0, 12).map(([id, labels]) => {
              const item = itemById?.get(id);
              if (!item || !matchesSearch(item)) return null;
              return (
                <Badge key={id} variant="outline" className="gap-1">
                  {item.name}
                  <span className="text-muted-foreground">
                    · {labels.join(", ")}
                  </span>
                </Badge>
              );
            })}
          </div>
          <ItemTable
            items={items}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onEdit={onEdit}
            onCleanup={onCleanup}
            onMarkReviewed={onMarkReviewed}
          />
        </CardContent>
      </Card>
    </SectionCard>
  );
}
