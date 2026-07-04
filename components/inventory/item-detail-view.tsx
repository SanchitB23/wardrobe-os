"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeftIcon,
  DnaIcon,
  DropletsIcon,
  HistoryIcon,
  ImageIcon,
  PencilIcon,
  StarIcon,
} from "lucide-react";

import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { ItemImage } from "@/components/inventory/item-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useItemImages,
  useWardrobeItem,
  useWardrobeLookups,
} from "@/lib/wardrobe/hooks";
import { buildItemImageAltText } from "@/lib/wardrobe/images";
import { cn } from "@/lib/utils";
import {
  formatEnumLabel,
  formatRating,
  type ItemImageRow,
  type ItemStatus,
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

function HeroImage({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  if (!imageUrl) {
    return <ItemImagePlaceholder className="aspect-[3/4] w-full" />;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-muted/20 shadow-sm ring-1 ring-foreground/10">
      <ItemImage
        src={imageUrl}
        alt={buildItemImageAltText(name, "hero")}
        containerClassName="aspect-[3/4] w-full"
        className="aspect-[3/4] w-full object-cover"
      />
    </div>
  );
}

function ImageGallery({
  images,
  itemName,
  selectedImageUrl,
  onSelect,
}: {
  images: ItemImageRow[];
  itemName: string;
  selectedImageUrl: string | null;
  onSelect: (url: string) => void;
}) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">All images</h3>
      <div className="grid grid-cols-4 gap-2">
        {images.map((image) => (
          <button
            key={image.id}
            type="button"
            onClick={() => onSelect(image.image_url)}
            className={cn(
              "group relative overflow-hidden rounded-lg border bg-muted/30 shadow-sm ring-1 ring-foreground/5 transition-colors",
              selectedImageUrl === image.image_url && "ring-2 ring-primary",
            )}
          >
            <ItemImage
              src={image.image_url}
              alt={buildItemImageAltText(
                itemName,
                "gallery",
                image.image_type,
              )}
              containerClassName="aspect-square w-full"
              className="aspect-square w-full object-cover"
            />
            {image.is_primary && (
              <Badge
                variant="secondary"
                className="absolute top-1 left-1 px-1.5 py-0 text-[10px]"
              >
                Primary
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function OverviewCard({ item }: { item: WardrobeItemRow }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
        <CardDescription>Core catalog attributes for this piece.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DetailField label="Code">
            <span className="font-mono text-sm">{item.code}</span>
          </DetailField>
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
          <DetailField label="Status">
            {item.status ? (
              <Badge variant={statusBadgeVariant(item.status)}>
                {formatEnumLabel(item.status)}
              </Badge>
            ) : (
              "—"
            )}
          </DetailField>
          <DetailField label="Ownership">
            {item.ownership ? formatEnumLabel(item.ownership) : "—"}
          </DetailField>
          <DetailField label="Fit">
            {item.fit ? formatEnumLabel(item.fit) : "—"}
          </DetailField>
          <DetailField label="Formality">
            {item.formality ? formatEnumLabel(item.formality) : "—"}
          </DetailField>
          <DetailField label="Usage">
            {item.usage ? (
              <Badge variant={usageBadgeVariant(item.usage)}>
                {formatEnumLabel(item.usage)}
              </Badge>
            ) : (
              "—"
            )}
          </DetailField>
          <DetailField label="Rating">
            {item.rating !== null ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
                <span className="font-medium">{formatRating(item.rating)}</span>
                <span className="text-xs text-muted-foreground">/10</span>
              </span>
            ) : (
              "—"
            )}
          </DetailField>
        </dl>

        <div className="space-y-1 border-t pt-4">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Notes
          </dt>
          <dd className="text-sm whitespace-pre-wrap text-muted-foreground">
            {item.notes?.trim() ? item.notes : "No notes yet."}
          </dd>
        </div>
      </CardContent>
    </Card>
  );
}

function PlaceholderCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Coming soon.</p>
      </CardContent>
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
      <div className="grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        <Skeleton className="aspect-[3/4] w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
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
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const itemQuery = useWardrobeItem(itemId);
  const imagesQuery = useItemImages(itemId);
  const lookupsQuery = useWardrobeLookups();

  const isLoading = itemQuery.isPending || imagesQuery.isPending;
  const error =
    itemQuery.error?.message ?? imagesQuery.error?.message ?? null;

  const item = itemQuery.data;
  const images = imagesQuery.data ?? [];
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

  function handleRetry() {
    void Promise.all([itemQuery.refetch(), imagesQuery.refetch()]);
  }

  if (isLoading) {
    return <ItemDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-6 py-8 lg:px-8 lg:py-10">
        <InventoryErrorState
          message={error}
          onRetry={handleRetry}
          isRetrying={itemQuery.isFetching || imagesQuery.isFetching}
        />
      </div>
    );
  }

  if (!item) {
    return <ItemNotFound />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-6 py-8 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <Button variant="outline" render={<Link href="/inventory" />}>
          <ArrowLeftIcon />
          Back to Inventory
        </Button>
        <Button onClick={() => setFormOpen(true)}>
          <PencilIcon />
          Edit
        </Button>
      </header>

      <div className="grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <HeroImage imageUrl={heroImageUrl} name={item.name} />
          <ImageGallery
            images={images}
            itemName={item.name}
            selectedImageUrl={heroImageUrl}
            onSelect={setSelectedImageUrl}
          />
        </aside>

        <div className="space-y-6">
          <div className="space-y-2">
            <p className="font-mono text-sm text-muted-foreground">{item.code}</p>
            <h1 className="text-3xl font-semibold tracking-tight">{item.name}</h1>
            <div className="flex flex-wrap items-center gap-2 pt-1">
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
                <Badge variant="outline" className="tabular-nums">
                  <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                  {formatRating(item.rating)} / 10
                </Badge>
              )}
            </div>
          </div>

          <OverviewCard item={item} />

          <PlaceholderCard
            title="Style DNA"
            description="AI-powered style attributes and pairing signals."
            icon={DnaIcon}
          />

          <PlaceholderCard
            title="Care"
            description="Washing, storage, and maintenance guidance."
            icon={DropletsIcon}
          />

          <PlaceholderCard
            title="Wear History"
            description="Outfits, occasions, and wear frequency over time."
            icon={HistoryIcon}
          />
        </div>
      </div>

      <ItemFormDialog
        mode="edit"
        open={formOpen}
        item={item}
        lookups={lookups}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}
