"use client";

import { ImageIcon } from "lucide-react";

import { ItemImage } from "@/features/inventory/components/item-image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  OUTFIT_SLOT_DEFINITIONS,
  type OutfitPickerItem,
  type OutfitSlot,
} from "@/features/outfits/types";
import { cn } from "@/lib/utils";

type OutfitPreviewProps = {
  selection: Partial<Record<OutfitSlot, OutfitPickerItem | null>>;
  className?: string;
};

export function OutfitPreview({ selection, className }: OutfitPreviewProps) {
  const filledSlots = OUTFIT_SLOT_DEFINITIONS.filter(
    (definition) => selection[definition.slot],
  );

  if (filledSlots.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-8 text-center",
          className,
        )}
      >
        <ImageIcon className="mb-3 size-10 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">Outfit preview</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Select items in each slot to see your outfit come together.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {filledSlots.map((definition) => {
        const item = selection[definition.slot];
        if (!item) {
          return null;
        }

        return (
          <Card key={definition.slot} className="overflow-hidden py-0">
            <CardContent className="p-0">
              <div className="grid min-h-[180px] grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-0">
                <div className="relative aspect-[4/5] min-h-[180px] bg-muted/30 sm:min-h-[220px]">
                  {item.primary_image_url ? (
                    <ItemImage
                      src={item.primary_image_url}
                      alt={item.name}
                      containerClassName="absolute inset-0 size-full"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted/40 text-muted-foreground">
                      <ImageIcon className="size-8 opacity-60" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center gap-2 border-l p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{definition.label}</Badge>
                    {definition.optional ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        Optional
                      </Badge>
                    ) : null}
                  </div>
                  <div>
                    <p className="font-medium leading-snug">{item.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[item.code, item.brand?.name, item.category?.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
