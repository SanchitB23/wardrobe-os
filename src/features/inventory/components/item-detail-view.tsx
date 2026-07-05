"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeftIcon, CalendarPlusIcon, ImageIcon, PencilIcon, StarIcon } from "lucide-react";

import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { ItemFormDialog } from "@/features/inventory/components/item-form-dialog";
import { ItemImage } from "@/features/inventory/components/item-image";
import { LogWearDialog } from "@/features/wear-logs/components/log-wear-dialog";
import { PurchaseFormDialog } from "@/features/purchases/components/purchase-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  useWardrobeItemDetail,
  useWardrobeLookups,
} from "@/features/inventory/hooks";
import { useItemPurchaseDetail } from "@/features/purchases/hooks";
import { useItemWearSummary } from "@/features/wear-logs/hooks";
import { buildItemImageAltText } from "@/features/inventory/services/images.service";
import { formatPurchaseDisplayDate } from "@/features/purchases/services/purchases.service";
import { formatWearLogDisplayDate } from "@/features/wear-logs/services/wear-logs.service";
import { cn } from "@/lib/utils";
import {
  formatEnumLabel,
  formatCurrency,
  formatRating,
  type ItemCareProfile,
  type ItemImageRow,
  type ItemOccasionRelation,
  type ItemStatus,
  type ItemWearSummary,
  type ItemPurchaseDetail,
  type LookupOption,
  type UsageFrequency,
  type WardrobeItemRow,
} from "@/types/wardrobe";

type ItemDetailViewProps = {
  itemId: string;
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

function displayText(value: string | null | undefined) {
  return value?.trim() ? value : "—";
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function BadgeGroup({
  label,
  items,
}: {
  label: string;
  items: LookupOption[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge key={item.id} variant="secondary">
              {item.name}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">None assigned</p>
      )}
    </div>
  );
}

function ItemImagePlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 text-muted-foreground",
        className,
      )}
    >
      <ImageIcon className="size-10 opacity-60" />
      <span className="text-sm">No image</span>
    </div>
  );
}

function ItemHeaderCard({
  item,
  heroImageUrl,
  images,
  selectedImageUrl,
  onSelectImage,
}: {
  item: WardrobeItemRow;
  heroImageUrl: string | null;
  images: ItemImageRow[];
  selectedImageUrl: string | null;
  onSelectImage: (url: string) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4">
            {heroImageUrl ? (
              <div className="overflow-hidden rounded-xl border bg-muted/20 shadow-sm ring-1 ring-foreground/10">
                <ItemImage
                  src={heroImageUrl}
                  alt={buildItemImageAltText(item.name, "hero")}
                  containerClassName="aspect-[3/4] w-full"
                  className="aspect-[3/4] w-full object-cover"
                />
              </div>
            ) : (
              <ItemImagePlaceholder className="aspect-[3/4] w-full" />
            )}

            {images.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    All images
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => onSelectImage(image.image_url)}
                        className={cn(
                          "relative overflow-hidden rounded-lg border bg-muted/30 ring-1 ring-foreground/5 transition-colors",
                          selectedImageUrl === image.image_url &&
                            "ring-2 ring-primary",
                        )}
                      >
                        <ItemImage
                          src={image.image_url}
                          alt={buildItemImageAltText(
                            item.name,
                            "gallery",
                            image.image_type,
                          )}
                          containerClassName="aspect-square w-full"
                          className="aspect-square w-full object-cover"
                        />
                        {image.is_primary && (
                          <Badge
                            variant="secondary"
                            className="absolute top-1 left-1 px-1 py-0 text-[10px]"
                          >
                            Primary
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col justify-center space-y-4">
            <div className="space-y-2">
              <p className="font-mono text-sm text-muted-foreground">{item.code}</p>
              <h1 className="text-3xl font-semibold tracking-tight">{item.name}</h1>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              {item.status && (
                <Badge variant={statusBadgeVariant(item.status)}>
                  {formatEnumLabel(item.status)}
                </Badge>
              )}
              {item.usage && (
                <Badge variant={usageBadgeVariant(item.usage)}>
                  {formatEnumLabel(item.usage)}
                </Badge>
              )}
              {item.rating !== null && (
                <Badge variant="outline" className="gap-1 tabular-nums">
                  <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                  {formatRating(item.rating)} / 10
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CoreInfoCard({ item }: { item: WardrobeItemRow }) {
  return (
    <SectionCard
      title="Core Info"
      description="Classification, brand, and fit attributes."
    >
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailField label="Category">
          {displayText(item.category?.name)}
        </DetailField>
        <DetailField label="Subcategory">
          {displayText(item.subcategory?.name)}
        </DetailField>
        <DetailField label="Brand">
          {displayText(item.brand?.name)}
        </DetailField>
        <DetailField label="Primary color">
          {displayText(item.primary_color?.name)}
        </DetailField>
        <DetailField label="Fit">
          {item.fit ? formatEnumLabel(item.fit) : "—"}
        </DetailField>
        <DetailField label="Formality">
          {item.formality ? formatEnumLabel(item.formality) : "—"}
        </DetailField>
      </dl>
    </SectionCard>
  );
}

function StyleDnaCard({
  styles,
  materials,
  features,
}: {
  styles: LookupOption[];
  materials: LookupOption[];
  features: LookupOption[];
}) {
  return (
    <SectionCard
      title="Style DNA"
      description="Aesthetic profile, fabric, and construction signals."
    >
      <div className="space-y-5">
        <BadgeGroup label="Styles" items={styles} />
        <Separator />
        <BadgeGroup label="Materials" items={materials} />
        <Separator />
        <BadgeGroup label="Features" items={features} />
      </div>
    </SectionCard>
  );
}

function SeasonTagsCard({
  seasons,
  tags,
}: {
  seasons: LookupOption[];
  tags: LookupOption[];
}) {
  return (
    <SectionCard
      title="Season & Tags"
      description="When to wear it and how you label it."
    >
      <div className="space-y-5">
        <BadgeGroup label="Seasons" items={seasons} />
        <Separator />
        <BadgeGroup label="Tags" items={tags} />
      </div>
    </SectionCard>
  );
}

function OccasionCard({ occasion }: { occasion: ItemOccasionRelation }) {
  const name = occasion.occasion?.name ?? "Unknown occasion";

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{name}</p>
        {occasion.score !== null && (
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {occasion.score}/10
          </Badge>
        )}
      </div>
      {occasion.notes?.trim() ? (
        <p className="mt-2 text-sm text-muted-foreground">{occasion.notes}</p>
      ) : null}
    </div>
  );
}

function OccasionsCard({ occasions }: { occasions: ItemOccasionRelation[] }) {
  return (
    <SectionCard
      title="Occasions"
      description="Suitability scores for different contexts."
    >
      {occasions.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {occasions.map((occasion) => (
            <OccasionCard key={occasion.id} occasion={occasion} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No occasions linked yet.</p>
      )}
    </SectionCard>
  );
}

function CareCard({ care }: { care: ItemCareProfile | null }) {
  return (
    <SectionCard
      title="Care"
      description="Storage, washing, and maintenance guidance."
    >
      {care ? (
        <dl className="space-y-4">
          <DetailField label="Storage">
            {displayText(care.storage ?? care.storage_type?.name)}
          </DetailField>
          <Separator />
          <DetailField label="Wash">{displayText(care.wash)}</DetailField>
          {care.notes?.trim() ? (
            <>
              <Separator />
              <div className="space-y-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Notes
                </dt>
                <dd className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {care.notes}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          No care profile recorded for this item.
        </p>
      )}
    </SectionCard>
  );
}

function WearSummaryCard({
  summary,
  isLoading,
}: {
  summary: ItemWearSummary | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <SectionCard
        title="Wear tracking"
        description="Logged wears and comfort over time."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </SectionCard>
    );
  }

  const wearSummary = summary ?? {
    totalWears: 0,
    lastWornOn: null,
    averageComfortRating: null,
    recentLogs: [],
  };

  return (
    <SectionCard
      title="Wear tracking"
      description="Logged wears and comfort over time."
    >
      <dl className="grid gap-4 sm:grid-cols-3">
        <DetailField label="Total wears">
          <span className="text-2xl font-semibold tabular-nums">
            {wearSummary.totalWears}
          </span>
        </DetailField>
        <DetailField label="Last worn">
          {wearSummary.lastWornOn
            ? formatWearLogDisplayDate(wearSummary.lastWornOn)
            : "—"}
        </DetailField>
        <DetailField label="Average comfort">
          {wearSummary.averageComfortRating !== null ? (
            <div className="inline-flex items-center gap-1 tabular-nums">
              <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
              <span className="font-medium">
                {formatRating(wearSummary.averageComfortRating)}
              </span>
              <span className="text-xs text-muted-foreground">/10</span>
            </div>
          ) : (
            "—"
          )}
        </DetailField>
      </dl>

      <Separator className="my-4" />

      {wearSummary.recentLogs.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Occasion</TableHead>
                <TableHead>Comfort</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wearSummary.recentLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatWearLogDisplayDate(log.worn_on)}
                  </TableCell>
                  <TableCell>{log.occasion?.name ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">
                    {log.comfort_rating !== null
                      ? `${formatRating(log.comfort_rating)}/10`
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate">
                    {log.notes?.trim() || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No wear logs yet. Log your first wear to start tracking this item.
        </p>
      )}
    </SectionCard>
  );
}

function PurchaseCard({
  item,
  detail,
  isLoading,
  onEdit,
}: {
  item: WardrobeItemRow;
  detail: ItemPurchaseDetail | undefined;
  isLoading: boolean;
  onEdit: () => void;
}) {
  if (isLoading) {
    return (
      <SectionCard
        title="Purchase"
        description="Purchase history and cost-per-wear for this item."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </SectionCard>
    );
  }

  const purchase = detail?.purchase ?? null;
  const wearCount = detail?.wearCount ?? 0;
  const costPerWear =
    wearCount === 0 ? null : detail?.costPerWear ?? null;

  return (
    <SectionCard
      title="Purchase"
      description="Purchase history and cost-per-wear for this item."
    >
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={onEdit}>
          {purchase ? "Edit purchase" : "Add purchase"}
        </Button>
      </div>

      {purchase ? (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Purchase date">
            {formatPurchaseDisplayDate(purchase.purchase_date)}
          </DetailField>
          <DetailField label="Price">
            {formatCurrency(Number(purchase.price))}
          </DetailField>
          <DetailField label="Purchase source">
            {displayText(purchase.source)}
          </DetailField>
          <DetailField label="Purchase status">
            {purchase.status
              ? formatEnumLabel(String(purchase.status))
              : "—"}
          </DetailField>
          {purchase.status === "returned" ? (
            <DetailField label="Return reason">
              {displayText(purchase.return_reason)}
            </DetailField>
          ) : null}
          <DetailField label="Cost per wear">
            {costPerWear !== null
              ? formatCurrency(costPerWear)
              : "Not enough data"}
          </DetailField>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          No purchase recorded for {item.name} yet.
        </p>
      )}
    </SectionCard>
  );
}

function NotesCard({ notes }: { notes: string | null }) {
  return (
    <SectionCard title="Notes" description="Free-form context and reminders.">
      <p className="text-sm whitespace-pre-wrap text-muted-foreground">
        {notes?.trim() ? notes : "No notes yet."}
      </p>
    </SectionCard>
  );
}

function ItemDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-6 py-8 lg:px-8 lg:py-10">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-[420px] w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

function ItemNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Item not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This wardrobe item may have been removed or the link is invalid.
      </p>
      <Button render={<Link href="/inventory" />}>
        <ArrowLeftIcon />
        Back to Inventory
      </Button>
    </div>
  );
}

export function ItemDetailView({ itemId }: ItemDetailViewProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [logWearOpen, setLogWearOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const detailQuery = useWardrobeItemDetail(itemId);
  const wearSummaryQuery = useItemWearSummary(itemId);
  const purchaseDetailQuery = useItemPurchaseDetail(itemId);
  const lookupsQuery = useWardrobeLookups();

  const detail = detailQuery.data;
  const item = detail?.item;
  const images = detail?.images ?? [];
  const relations = detail?.relations;
  const lookups = lookupsQuery.data ?? {
    categories: [],
    subcategories: [],
    brands: [],
    colors: [],
  };

  const heroImageUrl =
    selectedImageUrl ??
    item?.primary_image_url ??
    images.find((image) => image.is_primary)?.image_url ??
    images[0]?.image_url ??
    null;

  if (detailQuery.isPending) {
    return <ItemDetailSkeleton />;
  }

  if (detailQuery.error) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-6 py-8 lg:px-8 lg:py-10">
        <InventoryErrorState
          message={detailQuery.error.message}
          onRetry={() => detailQuery.refetch()}
          isRetrying={detailQuery.isFetching}
        />
      </div>
    );
  }

  if (!item || !relations) {
    return <ItemNotFound />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-6 py-8 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <Button variant="outline" render={<Link href="/inventory" />}>
          <ArrowLeftIcon />
          Back to Inventory
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLogWearOpen(true)}>
            <CalendarPlusIcon />
            Log wear
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <PencilIcon />
            Edit
          </Button>
        </div>
      </header>

      <div className="space-y-6">
        <ItemHeaderCard
          item={item}
          heroImageUrl={heroImageUrl}
          images={images}
          selectedImageUrl={heroImageUrl}
          onSelectImage={setSelectedImageUrl}
        />

        <CoreInfoCard item={item} />

        <WearSummaryCard
          summary={wearSummaryQuery.data}
          isLoading={wearSummaryQuery.isPending}
        />

        <PurchaseCard
          item={item}
          detail={purchaseDetailQuery.data}
          isLoading={purchaseDetailQuery.isPending}
          onEdit={() => setPurchaseOpen(true)}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <StyleDnaCard
            styles={relations.styles}
            materials={relations.materials}
            features={relations.features}
          />
          <SeasonTagsCard seasons={relations.seasons} tags={relations.tags} />
        </div>

        <OccasionsCard occasions={relations.occasions} />

        <div className="grid gap-6 lg:grid-cols-2">
          <CareCard care={relations.care} />
          <NotesCard notes={item.notes} />
        </div>
      </div>

      <LogWearDialog
        item={item}
        open={logWearOpen}
        onOpenChange={(open) => {
          setLogWearOpen(open);
          if (!open) {
            void wearSummaryQuery.refetch();
            void purchaseDetailQuery.refetch();
          }
        }}
      />

      <PurchaseFormDialog
        item={item}
        purchase={purchaseDetailQuery.data?.purchase}
        open={purchaseOpen}
        onOpenChange={(open) => {
          setPurchaseOpen(open);
          if (!open) {
            void purchaseDetailQuery.refetch();
          }
        }}
      />

      <ItemFormDialog
        mode="edit"
        open={formOpen}
        item={item}
        lookups={lookups}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            void detailQuery.refetch();
          }
        }}
      />
    </div>
  );
}
