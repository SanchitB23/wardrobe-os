import type { ReactNode } from "react";
import { AlertCircleIcon, RefreshCwIcon, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Centered empty state with an icon, title, copy, and optional actions. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {actions ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Consistent retryable error state, styled as a destructive card. */
export function ErrorState({
  title = "Something went wrong",
  message,
  hint,
  onRetry,
  isRetrying = false,
}: {
  title?: string;
  message: string;
  hint?: ReactNode;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <AlertCircleIcon className="size-4 text-destructive" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-base text-destructive">{title}</CardTitle>
            <CardDescription className="text-destructive/80">
              {message}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hint ? (
          <p className="text-sm text-muted-foreground">{hint}</p>
        ) : null}
        <Button
          variant="outline"
          onClick={onRetry}
          disabled={isRetrying}
          className="bg-background"
        >
          <RefreshCwIcon className={isRetrying ? "animate-spin" : undefined} />
          {isRetrying ? "Retrying…" : "Try again"}
        </Button>
      </CardContent>
    </Card>
  );
}

/** Skeleton placeholder — a grid of cards or a stack of rows. */
export function LoadingState({
  variant = "rows",
  count = 6,
  className,
}: {
  variant?: "rows" | "cards";
  count?: number;
  className?: string;
}) {
  if (variant === "cards") {
    return (
      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
          className,
        )}
      >
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}
