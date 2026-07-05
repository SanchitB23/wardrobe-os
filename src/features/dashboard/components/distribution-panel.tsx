"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { ColorSwatch } from "@/shared/ui";
import { cn } from "@/lib/utils";

type DistributionRow = {
  id?: string | null;
  name: string;
  count: number;
  hex?: string | null;
};

type DistributionPanelProps = {
  title: string;
  description?: string;
  items: DistributionRow[];
  emptyMessage?: string;
  showColorBadge?: boolean;
  className?: string;
  /** When provided, each row links to the returned href (filtered inventory). */
  hrefFor?: (row: DistributionRow) => string;
};

export function DistributionPanel({
  title,
  description,
  items,
  emptyMessage = "No data yet.",
  showColorBadge = false,
  className,
  hrefFor,
}: DistributionPanelProps) {
  const maxCount = items.reduce((max, item) => Math.max(max, item.count), 0);

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((item) => {
              const percentage =
                maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;

              const href = hrefFor?.(item);
              const bars = (
                <Progress
                  value={percentage}
                  className="flex-col items-stretch gap-2"
                  aria-label={`${item.name}: ${item.count}`}
                >
                  <div className="flex items-center gap-2">
                    {showColorBadge ? (
                      <ColorSwatch
                        colorName={item.name}
                        hex={item.hex ?? null}
                        size="sm"
                      />
                    ) : null}
                    <ProgressLabel className="truncate">{item.name}</ProgressLabel>
                    {href ? (
                      <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />
                    ) : null}
                    <Badge variant="secondary" className="ml-auto tabular-nums">
                      {item.count}
                    </Badge>
                  </div>
                </Progress>
              );

              return (
                <li key={item.id ?? item.name}>
                  {href ? (
                    <Link
                      href={href}
                      className="group/row block cursor-pointer rounded-md -mx-2 px-2 py-1 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {bars}
                    </Link>
                  ) : (
                    bars
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
