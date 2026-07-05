import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Typography scale for Wardrobe OS.
 *
 * - Heading: page/section titles (level controls size, not just semantics)
 * - Text: default body copy
 * - Muted: secondary/supporting copy
 * - FieldLabel: uppercase micro-labels above values
 * - SectionTitle: a small titled block with optional description + actions
 */

const HEADING_SIZES = {
  1: "text-2xl font-semibold tracking-tight sm:text-3xl",
  2: "text-lg font-semibold tracking-tight",
  3: "text-base font-medium",
} as const;

export function Heading({
  level = 2,
  className,
  children,
}: {
  level?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  const Tag = (`h${level}` as const);
  return <Tag className={cn(HEADING_SIZES[level], className)}>{children}</Tag>;
}

export function Text({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <p className={cn("text-sm", className)}>{children}</p>;
}

export function Muted({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
  );
}

export function FieldLabel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "text-xs font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="space-y-0.5">
        <Heading level={2} className="text-sm font-medium">
          {title}
        </Heading>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
