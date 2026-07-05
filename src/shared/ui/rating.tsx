import { StarIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRating } from "@/types/wardrobe";

type RatingProps = {
  value: number | null | undefined;
  /** "inline" is the default row/list form; "badge" wraps it in an outline badge. */
  variant?: "inline" | "badge";
  className?: string;
};

/** Standard 0–10 rating display with a gold star. Renders an em dash when unset. */
export function Rating({ value, variant = "inline", className }: RatingProps) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (variant === "badge") {
    return (
      <Badge variant="outline" className={cn("gap-1 tabular-nums", className)}>
        <StarIcon className="size-3 fill-amber-400 text-amber-400" />
        {formatRating(value)} / 10
      </Badge>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-1 tabular-nums", className)}>
      <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
      <span className="font-medium">{formatRating(value)}</span>
      <span className="text-xs text-muted-foreground">/10</span>
    </div>
  );
}
