"use client";

import { ShirtIcon } from "lucide-react";

import type { SimilarExistingItem } from "@/features/acquisition/types";
import { Badge } from "@/components/ui/badge";

export function SimilarItems({ items }: { items: SimilarExistingItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No strongly overlapping items in your wardrobe.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.itemId} className="flex items-center gap-2 text-sm">
          <ShirtIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{item.name}</span>
          {item.lowUse ? (
            <Badge variant="secondary" className="text-[10px]">
              rarely worn
            </Badge>
          ) : null}
          <Badge variant="outline" className="tabular-nums">
            {Math.round(item.overlap * 100)}% match
          </Badge>
        </li>
      ))}
    </ul>
  );
}
