"use client";

import Link from "next/link";
import { LayersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OutfitListRow } from "@/features/outfits/types";

export function ItemOutfitsCard({
  outfits,
  isLoading,
}: {
  outfits: OutfitListRow[] | undefined;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <LayersIcon className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Outfits</CardTitle>
        </div>
        <CardDescription>Saved outfits that feature this item.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : !outfits || outfits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No saved outfits feature this item yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {outfits.map((outfit) => (
              <li key={outfit.id}>
                <Link
                  href={`/outfits/${outfit.id}`}
                  className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="flex-1 truncate font-medium">
                    {outfit.name}
                  </span>
                  {outfit.occasion ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {outfit.occasion.name}
                    </span>
                  ) : null}
                  <Badge variant="outline" className="tabular-nums whitespace-nowrap">
                    {outfit.itemCount} item{outfit.itemCount === 1 ? "" : "s"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
