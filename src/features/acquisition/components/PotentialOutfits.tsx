"use client";

import { LayersIcon } from "lucide-react";

import type { PotentialOutfit } from "@/features/acquisition/types";
import { Badge } from "@/components/ui/badge";

export function PotentialOutfits({ outfits }: { outfits: PotentialOutfit[] }) {
  if (outfits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough complementary items to build outfits yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {outfits.map((outfit, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <LayersIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">{outfit.itemNames.join(" + ")}</span>
          <Badge variant="secondary" className="tabular-nums">
            {outfit.score.toFixed(1)}/10
          </Badge>
        </li>
      ))}
    </ul>
  );
}
