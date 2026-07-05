import type { ReactNode } from "react";
import {
  ArchiveIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  HeartIcon,
  RotateCcwIcon,
  ShirtIcon,
  SparklesIcon,
  StarIcon,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatRating,
  type FormalityEnum,
  type ItemStatus,
  type UsageFrequency,
} from "@/types/wardrobe";

/* ------------------------------------------------------------------ */
/* Tones — the single source of badge color styling (dark-mode aware) */
/* ------------------------------------------------------------------ */

export type BadgeTone =
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "muted"
  | "premium"
  | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success:
    "border-transparent bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  info: "border-transparent bg-blue-500/15 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  warning:
    "border-transparent bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  danger:
    "border-transparent bg-red-500/15 text-red-700 dark:bg-red-400/15 dark:text-red-300",
  muted: "border-transparent bg-muted text-muted-foreground",
  premium:
    "border-transparent bg-gradient-to-r from-amber-400/20 to-fuchsia-400/20 text-amber-700 dark:from-amber-300/15 dark:to-fuchsia-300/15 dark:text-amber-200",
  neutral: "border-border bg-transparent text-foreground",
};

/** Base pill using a semantic tone. Prefer the specific badges below. */
export function TonedBadge({
  tone,
  icon: Icon,
  className,
  children,
  ariaLabel,
}: {
  tone: BadgeTone;
  icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <Badge
      variant="secondary"
      aria-label={ariaLabel}
      className={cn(TONE_CLASSES[tone], "gap-1 font-medium", className)}
    >
      {Icon ? <Icon className="size-3" /> : null}
      {children}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Human-readable label formatters                                    */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<ItemStatus, string> = {
  active: "Active",
  retired: "Retired",
  returned: "Returned",
};

const USAGE_LABELS: Record<UsageFrequency, string> = {
  rare: "Rare",
  occasional: "Occasional",
  regular: "Regular",
  frequent: "Frequent",
  hero: "Hero",
};

const FORMALITY_LABELS: Record<FormalityEnum, string> = {
  casual: "Casual",
  smart_casual: "Smart Casual",
  business_casual: "Business Casual",
  business_formal: "Business Formal",
  formal: "Formal",
};

export function formatStatusLabel(status: ItemStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatUsageLabel(usage: UsageFrequency): string {
  return USAGE_LABELS[usage] ?? usage;
}

export function formatFormalityLabel(formality: FormalityEnum): string {
  return FORMALITY_LABELS[formality] ?? formality;
}

/* ------------------------------------------------------------------ */
/* Specific badges                                                    */
/* ------------------------------------------------------------------ */

const STATUS_TONE: Record<ItemStatus, BadgeTone> = {
  active: "success",
  retired: "muted",
  returned: "warning",
};

const STATUS_ICON: Record<ItemStatus, LucideIcon> = {
  active: CheckCircleIcon,
  retired: ArchiveIcon,
  returned: RotateCcwIcon,
};

export function StatusBadge({
  status,
  className,
}: {
  status: ItemStatus;
  className?: string;
}) {
  return (
    <TonedBadge
      tone={STATUS_TONE[status]}
      icon={STATUS_ICON[status]}
      className={className}
    >
      {formatStatusLabel(status)}
    </TonedBadge>
  );
}

const USAGE_TONE: Record<UsageFrequency, BadgeTone> = {
  hero: "premium",
  frequent: "success",
  regular: "info",
  occasional: "muted",
  rare: "neutral",
};

export function UsageBadge({
  usage,
  className,
}: {
  usage: UsageFrequency;
  className?: string;
}) {
  return (
    <TonedBadge
      tone={USAGE_TONE[usage]}
      icon={usage === "hero" ? StarIcon : undefined}
      className={className}
    >
      {formatUsageLabel(usage)}
    </TonedBadge>
  );
}

const FORMALITY_TONE: Record<FormalityEnum, BadgeTone> = {
  casual: "neutral",
  smart_casual: "info",
  business_casual: "info",
  business_formal: "premium",
  formal: "premium",
};

export function FormalityBadge({
  formality,
  className,
}: {
  formality: FormalityEnum;
  className?: string;
}) {
  return (
    <TonedBadge
      tone={FORMALITY_TONE[formality]}
      icon={BriefcaseIcon}
      className={className}
    >
      {formatFormalityLabel(formality)}
    </TonedBadge>
  );
}

/** Star rating as a tiered badge: ≥9.5 premium, 8–9.4 normal, <8 muted. */
export function RatingBadge({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const tone: BadgeTone =
    value >= 9.5 ? "premium" : value >= 8 ? "success" : "warning";
  return (
    <Badge
      variant="secondary"
      aria-label={`Rating: ${formatRating(value)} out of 10`}
      className={cn(TONE_CLASSES[tone], "gap-1 font-medium tabular-nums", className)}
    >
      <StarIcon className="size-3 fill-current" />
      {formatRating(value)}/10
    </Badge>
  );
}

/** Compact favorite indicator (icon-only by default). */
export function FavoriteBadge({
  showLabel = false,
  className,
}: {
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <TonedBadge
      tone="danger"
      className={cn(
        "border-transparent bg-rose-500/15 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
        className,
      )}
      ariaLabel={showLabel ? undefined : "Favorite"}
    >
      <HeartIcon className="size-3 fill-current" />
      {showLabel ? "Favorite" : null}
    </TonedBadge>
  );
}

/** Premium "Hero piece" marker. */
export function HeroBadge({ className }: { className?: string }) {
  return (
    <TonedBadge tone="premium" icon={SparklesIcon} className={className}>
      Hero piece
    </TonedBadge>
  );
}

/** Generic metadata pill for tags, styles, features, materials, seasons. */
export function MetadataBadge({
  label,
  variant = "default",
  icon,
  className,
}: {
  label: string;
  variant?: "default" | "muted" | "premium" | "warning" | "success";
  icon?: LucideIcon;
  className?: string;
}) {
  const tone: BadgeTone =
    variant === "default" ? "neutral" : (variant as BadgeTone);
  return (
    <TonedBadge tone={tone} icon={icon} className={cn("font-normal", className)}>
      {label}
    </TonedBadge>
  );
}

/** Color name with a small swatch dot (see ColorSwatch for the full chip). */
export function BrandBadge({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  if (!name) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Badge variant="outline" className={cn("font-normal", className)}>
      <ShirtIcon className="size-3" />
      {name}
    </Badge>
  );
}
