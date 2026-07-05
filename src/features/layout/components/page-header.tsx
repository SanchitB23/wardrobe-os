import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  /** Optional inline node beside the title (e.g. a count Badge). */
  badge?: ReactNode;
  description?: ReactNode;
  /** Page-specific actions, right-aligned on desktop. */
  actions?: ReactNode;
  /** Optional node above the title (e.g. a back link). */
  breadcrumb?: ReactNode;
  className?: string;
};

/**
 * Consistent page header used across routes. Pages provide only their own
 * title/badge/description/actions — global navigation lives in the AppShell.
 */
export function PageHeader({
  title,
  badge,
  description,
  actions,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        {breadcrumb ? <div>{breadcrumb}</div> : null}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {badge}
        </div>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
