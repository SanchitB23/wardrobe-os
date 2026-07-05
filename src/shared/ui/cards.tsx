import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * StatCard — a compact metric tile: label, large value, icon, and a small
 * caption. Used across dashboard and inventory summaries.
 */
export function StatCard({
  label,
  value,
  caption,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  icon?: LucideIcon;
}) {
  return (
    <Card size="sm">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {value}
            </CardTitle>
          </div>
          {Icon ? (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="size-4 text-muted-foreground" />
            </div>
          ) : null}
        </div>
      </CardHeader>
      {caption ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{caption}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

/**
 * ImageCard — a presentational image frame with consistent radius, ring, and
 * aspect ratio. The image node is passed as children so this stays free of any
 * feature-specific image component.
 */
export function ImageCard({
  aspect = "portrait",
  children,
  className,
}: {
  aspect?: "portrait" | "square" | "landscape";
  children: ReactNode;
  className?: string;
}) {
  const aspectClass =
    aspect === "square"
      ? "aspect-square"
      : aspect === "landscape"
        ? "aspect-[4/3]"
        : "aspect-[3/4]";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-muted/20 shadow-sm ring-1 ring-foreground/10",
        aspectClass,
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * MetricCard — a titled card wrapper with optional description and actions,
 * for richer metric/detail panels.
 */
export function MetricCard({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
