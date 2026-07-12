"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2Icon, PencilIcon } from "lucide-react";

import { ItemFormDialog } from "@/features/inventory/components/item-form-dialog";
import { ItemImage } from "@/features/inventory/components/item-image";
import { buildItemImageAltText } from "@/features/inventory/services/images.service";
import {
  useWardrobeItemDetail,
  useWardrobeLookups,
} from "@/features/inventory/hooks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ColorSwatch,
  FormalityBadge,
  MetadataBadge,
  RatingBadge,
  StatusBadge,
  UsageBadge,
} from "@/shared/ui";
import {
  formatEnumLabel,
  type LookupOption,
  type WardrobeLookups,
} from "@/types/wardrobe";

type ItemPreviewDialogProps = {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const EMPTY_LOOKUPS: WardrobeLookups = {
  categories: [],
  subcategories: [],
  brands: [],
  colors: [],
  seasons: [],
  occasions: [],
  materials: [],
};

function PreviewField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">
        {children ?? (value?.trim() ? value : "—")}
      </dd>
    </div>
  );
}

export function ItemPreviewDialog({
  itemId,
  open,
  onOpenChange,
}: ItemPreviewDialogProps) {
  const [editOpen, setEditOpen] = useState(false);

  const detailQuery = useWardrobeItemDetail(itemId ?? "");
  const lookupsQuery = useWardrobeLookups();

  const detail = detailQuery.data;
  const item = detail?.item;
  const lookups = lookupsQuery.data ?? EMPTY_LOOKUPS;

  return (
    <>
      {/* Preview is hidden while editing (swap), shown again when edit closes. */}
      <Dialog open={open && !editOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{item?.name ?? "Item preview"}</DialogTitle>
            <DialogDescription>
              {item ? item.code : "Loading item…"}
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isPending ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2Icon className="size-5 animate-spin" /> Loading…
            </div>
          ) : detailQuery.isError || !item || !detail ? (
            <p className="py-8 text-center text-sm text-destructive">
              {detailQuery.error?.message ?? "Item not found."}
            </p>
          ) : (
            <div className="space-y-4">
              {item.primary_image_url ? (
                <ItemImage
                  src={item.primary_image_url}
                  alt={buildItemImageAltText(item.name, "hero")}
                  containerClassName="aspect-[3/4] w-full max-w-56 rounded-lg border bg-muted/30"
                  className="h-full w-full object-cover"
                />
              ) : null}

              <div className="space-y-1">
                {item.brand?.name ? (
                  <p className="text-sm text-muted-foreground">
                    {item.brand.name}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {item.status ? <StatusBadge status={item.status} /> : null}
                  {item.usage ? <UsageBadge usage={item.usage} /> : null}
                  {item.rating !== null ? (
                    <RatingBadge value={item.rating} />
                  ) : null}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <PreviewField label="Category" value={item.category?.name} />
                <PreviewField
                  label="Subcategory"
                  value={item.subcategory?.name}
                />
                <PreviewField label="Color">
                  {item.primary_color?.name ? (
                    <ColorSwatch colorName={item.primary_color.name} showLabel />
                  ) : (
                    "—"
                  )}
                </PreviewField>
                <PreviewField
                  label="Fit"
                  value={item.fit ? formatEnumLabel(item.fit) : null}
                />
                <PreviewField label="Formality">
                  {item.formality ? (
                    <FormalityBadge formality={item.formality} />
                  ) : (
                    "—"
                  )}
                </PreviewField>
              </dl>

              {detail.relations.materials.length +
                detail.relations.tags.length >
              0 ? (
                <div className="flex flex-wrap gap-2">
                  {[
                    ...detail.relations.materials,
                    ...detail.relations.tags,
                  ].map((rel: LookupOption) => (
                    <MetadataBadge key={rel.id} label={rel.name} />
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!item}
                onClick={() => setEditOpen(true)}
              >
                <PencilIcon className="size-4" /> Edit
              </Button>
              {item ? (
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/inventory/${item.id}`} />}
                >
                  Open full page
                </Button>
              ) : null}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {item ? (
        <ItemFormDialog
          mode="edit"
          open={editOpen}
          item={item}
          lookups={lookups}
          onOpenChange={(next) => {
            setEditOpen(next);
            if (!next) {
              // Item attributes (incl. category/slot) may have changed.
              void detailQuery.refetch();
            }
          }}
        />
      ) : null}
    </>
  );
}
