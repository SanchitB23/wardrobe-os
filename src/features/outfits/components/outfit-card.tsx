"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDaysIcon,
  CopyIcon,
  GaugeIcon,
  HeartIcon,
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
import { formatOutfitModifiedAt } from "@/features/outfits/services/outfits.service";
import { formatRating, type OutfitListRow } from "@/features/outfits/types";

type OutfitCardProps = {
  outfit: OutfitListRow;
  score?: number | null;
  onDelete: (outfit: OutfitListRow) => void;
  onDuplicate: (outfit: OutfitListRow) => void;
  onWear: (outfit: OutfitListRow) => void;
  onToggleFavorite: (outfit: OutfitListRow) => void;
  isDuplicating?: boolean;
};

function scoreTone(score: number): string {
  if (score >= 8) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (score >= 6) {
    return "text-amber-600 dark:text-amber-400";
  }
  return "text-destructive";
}

export function OutfitCard({
  outfit,
  score = null,
  onDelete,
  onDuplicate,
  onWear,
  onToggleFavorite,
  isDuplicating = false,
}: OutfitCardProps) {
  const router = useRouter();

  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      <Link
        href={`/outfits/${outfit.id}`}
        aria-label={`View ${outfit.name}`}
        className="absolute inset-0"
      />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="line-clamp-2 text-base leading-snug">
              <Link
                href={`/outfits/${outfit.id}`}
                tabIndex={-1}
                className="relative z-10 hover:underline focus-visible:underline"
              >
                {outfit.name}
              </Link>
            </CardTitle>
            <CardDescription>
              Modified {formatOutfitModifiedAt(outfit)}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative z-10"
              aria-label={
                outfit.favorite
                  ? `Unfavorite ${outfit.name}`
                  : `Favorite ${outfit.name}`
              }
              aria-pressed={outfit.favorite}
              onClick={() => onToggleFavorite(outfit)}
            >
              <HeartIcon
                className={
                  outfit.favorite
                    ? "fill-rose-500 text-rose-500"
                    : "text-muted-foreground"
                }
              />
            </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative z-10 shrink-0 opacity-70 group-hover:opacity-100"
                  aria-label={`Actions for ${outfit.name}`}
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={outfit.itemCount === 0}
                onClick={() => onWear(outfit)}
              >
                <CalendarDaysIcon />
                Wear
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/outfits/${outfit.id}/edit`)}
              >
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
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed bg-muted/20">
          <div className="text-center">
            <LayersIcon className="mx-auto mb-2 size-8 text-muted-foreground/70" />
            <p className="text-sm font-medium tabular-nums">
              {outfit.itemCount} item{outfit.itemCount === 1 ? "" : "s"}
            </p>
          </div>
          {score !== null ? (
            <Badge
              variant="secondary"
              className="absolute right-2 top-2 gap-1 tabular-nums"
            >
              <GaugeIcon className="size-3" />
              <span className={scoreTone(score)}>{score}/10</span>
            </Badge>
          ) : null}
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
          className="relative z-10 w-full"
          render={<Link href={`/outfits/${outfit.id}/edit`} />}
        >
          <PencilIcon />
          Edit outfit
        </Button>
      </CardContent>
    </Card>
  );
}
