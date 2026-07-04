"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CopyIcon,
  LayersIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatOutfitModifiedAt } from "@/lib/wardrobe/outfits";
import { formatRating, type OutfitListRow } from "@/types/wardrobe";

type OutfitCardProps = {
  outfit: OutfitListRow;
  onDelete: (outfit: OutfitListRow) => void;
  onDuplicate: (outfit: OutfitListRow) => void;
  isDuplicating?: boolean;
};

export function OutfitCard({
  outfit,
  onDelete,
  onDuplicate,
  isDuplicating = false,
}: OutfitCardProps) {
  const router = useRouter();

  return (
    <Card className="group relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="line-clamp-2 text-base leading-snug">
              <Link
                href={`/outfits/${outfit.id}`}
                className="hover:underline focus-visible:underline"
              >
                {outfit.name}
              </Link>
            </CardTitle>
            <CardDescription>
              Modified {formatOutfitModifiedAt(outfit)}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 opacity-70 group-hover:opacity-100"
                  aria-label={`Actions for ${outfit.name}`}
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/outfits/${outfit.id}`)}>
                <PencilIcon />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isDuplicating}
                onClick={() => onDuplicate(outfit)}
              >
                <CopyIcon />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(outfit)}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed bg-muted/20">
          <div className="text-center">
            <LayersIcon className="mx-auto mb-2 size-8 text-muted-foreground/70" />
            <p className="text-sm font-medium tabular-nums">
              {outfit.itemCount} item{outfit.itemCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Occasion</dt>
            <dd className="font-medium">{outfit.occasion?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Season</dt>
            <dd className="font-medium">{outfit.season?.name ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Rating</dt>
            <dd className="font-medium">
              {outfit.rating !== null ? (
                <Badge variant="secondary">{formatRating(outfit.rating)}/10</Badge>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>

        <Button
          variant="outline"
          className="w-full"
          render={<Link href={`/outfits/${outfit.id}`} />}
        >
          <PencilIcon />
          Edit outfit
        </Button>
      </CardContent>
    </Card>
  );
}
