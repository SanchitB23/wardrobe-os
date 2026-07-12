"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { recordRecentItem } from "@/features/command-palette";
import {
  ArrowLeftIcon,
  CalendarPlusIcon,
  HeartIcon,
  LayersIcon,
  PencilIcon,
  SparklesIcon,
  Wand2Icon,
} from "lucide-react";

import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { ItemFormDialog } from "@/features/inventory/components/item-form-dialog";
import { ItemImageGallery } from "@/features/inventory/components/item-image-gallery";
import { ItemVisualAnalysisCard } from "@/features/inventory/components/item-visual-analysis-card";
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
  useWardrobeItemDetail,
  useWardrobeLookups,
  useToggleWardrobeItemFavoriteMutation,
} from "@/features/inventory/hooks";
import { useItemPurchaseDetail } from "@/features/purchases/hooks";
import { useItemWearSummary } from "@/features/wear-logs/hooks";
import { formatPurchaseDisplayDate } from "@/features/purchases/services/purchases.service";
import { formatWearLogDisplayDate } from "@/features/wear-logs/services/wear-logs.service";
import {
  ColorSwatch,
  FormalityBadge,
  HeroBadge,
  MetadataBadge,
  Rating,
  RatingBadge,
  StatusBadge,
  UsageBadge,
} from "@/shared/ui";
import {
  formatEnumLabel,
  formatCurrency,
  formatRating,
  type ItemCareProfile,
  type ItemOccasionRelation,
  type ItemWearSummary,
  type ItemPurchaseDetail,
  type LookupOption,
  type WardrobeItemRow,
} from "@/types/wardrobe";

type ItemDetailViewProps = {
  itemId: string;
};

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
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function BadgeGroup({ label, items }: { label: string; items: LookupOption[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <MetadataBadge key={item.id} label={item.name} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">None assigned</p>
      )}
    </div>
  );
}


function ImageColumn({
  item,
  materials,
  tags,
  onToggleFavorite,
  isFavoritePending,
}: {
  item: WardrobeItemRow;
  materials: LookupOption[];
  tags: LookupOption[];
  onToggleFavorite: () => void;
  isFavoritePending: boolean;
}) {
  const isHero = item.usage === "hero";

  return (
    <div className="lg:sticky lg:top-20 space-y-4">
      <ItemImageGallery
        itemId={item.id}
        itemName={item.name}
        overlay={
          <>
            {isHero ? (
              <HeroBadge className="absolute left-3 top-3 shadow-sm" />
            ) : null}
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-3 top-3 rounded-full shadow-sm"
              aria-label={
                item.favorite ? "Remove from favorites" : "Add to favorites"
              }
              aria-pressed={item.favorite}
              disabled={isFavoritePending}
              onClick={onToggleFavorite}
            >
              <HeartIcon
                className={
                  item.favorite ? "fill-rose-500 text-rose-500" : undefined
                }
              />
            </Button>
          </>
        }
      />
      <ItemVisualAnalysisCard
        itemId={item.id}
        manual={{
          color: item.primary_color?.name ?? null,
          material: materials[0]?.name ?? null,
          formality: item.formality ?? null,
          tags: tags.map((t) => t.name),
        }}
      />
    </div>
  );
}

function ItemHeader({ item }: { item: WardrobeItemRow }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="font-mono text-sm text-muted-foreground">{item.code}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{item.name}</h1>
        {item.brand?.name ? (
          <p className="text-base text-muted-foreground">{item.brand.name}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {item.status && <StatusBadge status={item.status} />}
        {item.usage && <UsageBadge usage={item.usage} />}
        {item.rating !== null && <RatingBadge value={item.rating} />}
      </div>
    </div>
  );
}

function OverviewCard({ item }: { item: WardrobeItemRow }) {
  return (
    <SectionCard
      title="Overview"
      description="Classification, brand, and fit attributes."
    >
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailField label="Category">
          {displayText(item.category?.name)}
        </DetailField>
        <DetailField label="Subcategory">
          {displayText(item.subcategory?.name)}
        </DetailField>
        <DetailField label="Brand">{displayText(item.brand?.name)}</DetailField>
        <DetailField label="Color">
          {item.primary_color?.name ? (
            <ColorSwatch colorName={item.primary_color.name} showLabel />
          ) : (
            "—"
          )}
        </DetailField>
        <DetailField label="Fit">
          {item.fit ? formatEnumLabel(item.fit) : "—"}
        </DetailField>
        <DetailField label="Formality">
          {item.formality ? <FormalityBadge formality={item.formality} /> : "—"}
        </DetailField>
      </dl>
    </SectionCard>
  );
}

function StyleDnaCard({
  styles,
  materials,
  features,
  seasons,
  tags,
  onEdit,
}: {
  styles: LookupOption[];
  materials: LookupOption[];
  features: LookupOption[];
  seasons: LookupOption[];
  tags: LookupOption[];
  onEdit: () => void;
}) {
  return (
    <SectionCard
      title="Style DNA"
      description="Aesthetic profile, fabric, construction, and seasonality."
      action={
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
      }
    >
      <div className="space-y-5">
        <BadgeGroup label="Styles" items={styles} />
        <Separator />
        <BadgeGroup label="Materials" items={materials} />
        <Separator />
        <BadgeGroup label="Features" items={features} />
        <Separator />
        <BadgeGroup label="Seasons" items={seasons} />
        {tags.length > 0 ? (
          <>
            <Separator />
            <BadgeGroup label="Tags" items={tags} />
          </>
        ) : null}
      </div>
    </SectionCard>
  );
}

function OccasionRow({ occasion }: { occasion: ItemOccasionRelation }) {
  const name = occasion.occasion?.name ?? "Unknown occasion";

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
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

function OccasionsCard({
  occasions,
  onEdit,
}: {
  occasions: ItemOccasionRelation[];
  onEdit: () => void;
}) {
  return (
    <SectionCard
      title="Occasions"
      description="Suitability scores for different contexts."
      action={
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
      }
    >
      {occasions.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {occasions.map((occasion) => (
            <OccasionRow key={occasion.id} occasion={occasion} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No occasions linked yet.</p>
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
      <SectionCard title="Purchase" description="Cost and source of this item.">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </SectionCard>
    );
  }

  const purchase = detail?.purchase ?? null;
  const wearCount = detail?.wearCount ?? 0;
  const costPerWear = wearCount === 0 ? null : (detail?.costPerWear ?? null);

  return (
    <SectionCard
      title="Purchase"
      description="Cost and source of this item."
      action={
        <Button variant="outline" size="sm" onClick={onEdit}>
          {purchase ? "Edit" : "Add"}
        </Button>
      }
    >
      {purchase ? (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Price">
            {formatCurrency(Number(purchase.price))}
          </DetailField>
          <DetailField label="Source">
            {displayText(purchase.source)}
          </DetailField>
          <DetailField label="Date">
            {formatPurchaseDisplayDate(purchase.purchase_date)}
          </DetailField>
          <DetailField label="Cost per wear">
            {costPerWear !== null ? formatCurrency(costPerWear) : "—"}
          </DetailField>
          {purchase.status === "returned" ? (
            <DetailField label="Return reason">
              {displayText(purchase.return_reason)}
            </DetailField>
          ) : null}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          No purchase recorded for {item.name} yet.
        </p>
      )}
    </SectionCard>
  );
}

function WearHistoryCard({
  summary,
  isLoading,
}: {
  summary: ItemWearSummary | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <SectionCard
        title="Wear history"
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
      title="Wear history"
      description="Logged wears and comfort over time."
    >
      <dl className="grid gap-4 sm:grid-cols-3">
        <DetailField label="Times worn">
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
          <Rating value={wearSummary.averageComfortRating} />
        </DetailField>
      </dl>

      {wearSummary.recentLogs.length > 0 ? (
        <>
          <Separator className="my-4" />
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Recent wears
          </p>
          <ol className="space-y-2">
            {wearSummary.recentLogs.map((log) => (
              <li
                key={log.id}
                className="flex items-start gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
              >
                <span className="tabular-nums whitespace-nowrap font-medium">
                  {formatWearLogDisplayDate(log.worn_on)}
                </span>
                <span className="flex-1 truncate text-muted-foreground">
                  {log.occasion?.name ?? "—"}
                  {log.notes?.trim() ? ` · ${log.notes}` : ""}
                </span>
                {log.comfort_rating !== null ? (
                  <span className="tabular-nums whitespace-nowrap text-muted-foreground">
                    {formatRating(log.comfort_rating)}/10
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <Separator className="my-4" />
          <p className="text-sm text-muted-foreground">
            No wear logs yet. Log your first wear to start tracking this item.
          </p>
        </>
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
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Storage">
            {displayText(care.storage ?? care.storage_type?.name)}
          </DetailField>
          <DetailField label="Wash">{displayText(care.wash)}</DetailField>
          {care.notes?.trim() ? (
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Notes
              </dt>
              <dd className="text-sm whitespace-pre-wrap text-muted-foreground">
                {care.notes}
              </dd>
            </div>
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

function NotesCard({ notes }: { notes: string | null }) {
  return (
    <SectionCard title="Notes" description="Free-form context and reminders.">
      <p className="text-sm whitespace-pre-wrap text-muted-foreground">
        {notes?.trim() ? notes : "No notes yet."}
      </p>
    </SectionCard>
  );
}

function ComingSoonCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof LayersIcon;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline" className="text-muted-foreground">
            Coming soon
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function ItemDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-6 py-8 lg:px-8 lg:py-10">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        <Skeleton className="aspect-[3/4] w-full rounded-xl" />
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
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

  const detailQuery = useWardrobeItemDetail(itemId);
  const favoriteMutation = useToggleWardrobeItemFavoriteMutation();

  const viewedItem = detailQuery.data?.item;
  useEffect(() => {
    if (viewedItem) {
      recordRecentItem({
        id: viewedItem.id,
        name: viewedItem.name,
        code: viewedItem.code,
      });
    }
  }, [viewedItem]);

  const wearSummaryQuery = useItemWearSummary(itemId);
  const purchaseDetailQuery = useItemPurchaseDetail(itemId);
  const lookupsQuery = useWardrobeLookups();

  const detail = detailQuery.data;
  const item = detail?.item;
  const relations = detail?.relations;
  const lookups = lookupsQuery.data ?? {
    categories: [],
    subcategories: [],
    brands: [],
    colors: [],
    seasons: [],
    occasions: [],
    materials: [],
  };

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

      <div className="grid gap-8 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] lg:items-start">
        <ImageColumn
          item={item}
          materials={relations.materials}
          tags={relations.tags}
          onToggleFavorite={() =>
            favoriteMutation.mutate({ id: item.id, favorite: !item.favorite })
          }
          isFavoritePending={favoriteMutation.isPending}
        />

        <div className="space-y-6">
          <ItemHeader item={item} />

          <OverviewCard item={item} />

          <StyleDnaCard
            styles={relations.styles}
            materials={relations.materials}
            features={relations.features}
            seasons={relations.seasons}
            tags={relations.tags}
            onEdit={() => setFormOpen(true)}
          />

          <OccasionsCard
            occasions={relations.occasions}
            onEdit={() => setFormOpen(true)}
          />

          <PurchaseCard
            item={item}
            detail={purchaseDetailQuery.data}
            isLoading={purchaseDetailQuery.isPending}
            onEdit={() => setPurchaseOpen(true)}
          />

          <WearHistoryCard
            summary={wearSummaryQuery.data}
            isLoading={wearSummaryQuery.isPending}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <CareCard care={relations.care} />
            <NotesCard notes={item.notes} />
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <ComingSoonCard
              title="Compatibility"
              description="How well this item pairs with the rest of your wardrobe."
              icon={SparklesIcon}
            />
            <ComingSoonCard
              title="AI recommendation"
              description="Smart styling suggestions for this piece."
              icon={Wand2Icon}
            />
            <ComingSoonCard
              title="Outfits"
              description="Saved outfits that feature this item."
              icon={LayersIcon}
            />
          </div>
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
