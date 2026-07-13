"use client";

import { SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ItemPairingReport,
  PairingCandidate,
} from "@/domain/pairing";
import type { OutfitSlot } from "@/types/wardrobe";

const SLOT_HEADINGS: Partial<Record<OutfitSlot, string>> = {
  top: "Tops",
  bottom: "Bottoms",
  footwear: "Footwear",
  outerwear: "Outerwear",
};

function ScoreBadge({ score }: { score: number }) {
  return (
    <Badge variant="outline" className="tabular-nums whitespace-nowrap">
      {score.toFixed(1)}/10
    </Badge>
  );
}

function PairingRow({ pairing }: { pairing: PairingCandidate }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
      <span className="flex-1">
        <span className="font-medium">{pairing.itemName}</span>
        {pairing.reasons[0] ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {pairing.reasons[0]}
          </span>
        ) : null}
      </span>
      <ScoreBadge score={pairing.score} />
    </li>
  );
}

export function ItemCompatibilityCard({
  report,
  isLoading,
}: {
  report: ItemPairingReport | undefined;
  isLoading: boolean;
}) {
  const title = "Compatibility";
  const description = "How well this item pairs with the rest of your wardrobe.";

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const inactive = report?.codes.includes("ANCHOR_INACTIVE") ?? false;
  const slotEmpty = report?.codes.includes("SLOT_EMPTY") ?? false;
  const slots = Object.entries(report?.pairingsBySlot ?? {}) as [
    OutfitSlot,
    PairingCandidate[],
  ][];

  return (
    <Card className={inactive ? "border-dashed opacity-75" : undefined}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">{title}</CardTitle>
          {report ? (
            <Badge variant="outline" className="text-muted-foreground">
              {report.codes.includes("PAIRING_STRONG")
                ? "Strong pairings"
                : inactive
                  ? "Inactive item"
                  : slotEmpty
                    ? "Needs more items"
                    : "Weak pairings"}
            </Badge>
          ) : null}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!report ? (
          <p className="text-sm text-muted-foreground">
            Pairing data is unavailable right now.
          </p>
        ) : inactive ? (
          <p className="text-sm text-muted-foreground">
            Pairings are only computed for active wardrobe items.
          </p>
        ) : slotEmpty ? (
          <p className="text-sm text-muted-foreground">
            Not enough complementary items to build complete outfits. Add
            active tops, bottoms, or footwear to see pairing suggestions.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {slots.map(([slot, pairings]) => (
                <div key={slot} className="space-y-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {SLOT_HEADINGS[slot] ?? slot}
                  </p>
                  <ul className="space-y-2">
                    {pairings.map((pairing) => (
                      <PairingRow key={pairing.itemId} pairing={pairing} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {report.outfits.length > 0 ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Best outfits with this
                  </p>
                  <ol className="space-y-2">
                    {report.outfits.map((outfit) => (
                      <li
                        key={outfit.itemIds.join("|")}
                        className="flex items-start gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                      >
                        <span className="flex-1">
                          {outfit.itemNames.join(" + ")}
                        </span>
                        <ScoreBadge score={outfit.score} />
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
