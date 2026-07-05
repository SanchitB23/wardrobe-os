import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Heading } from "@/shared/ui/typography";

/**
 * ItemHeader — a consistent detail-page header: a mono code line, a title, an
 * optional subtitle (e.g. brand), a row of badges, and optional actions.
 * Presentation-only; callers supply badges/actions as nodes.
 */
export function ItemHeader({
  code,
  title,
  subtitle,
  badges,
  actions,
  className,
}: {
  code?: string;
  title: string;
  subtitle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="space-y-3">
        <div className="space-y-1">
          {code ? (
            <p className="font-mono text-sm text-muted-foreground">{code}</p>
          ) : null}
          <Heading level={1}>{title}</Heading>
          {subtitle ? (
            <p className="text-base text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {badges ? (
          <div className="flex flex-wrap items-center gap-2">{badges}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}
