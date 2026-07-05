"use client";

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
};

export function DistributionPanel({
  title,
  description,
  items,
  emptyMessage = "No data yet.",
  showColorBadge = false,
  className,
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

              return (
                <li key={item.id ?? item.name}>
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
                      <Badge variant="secondary" className="ml-auto tabular-nums">
                        {item.count}
                      </Badge>
                    </div>
                  </Progress>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
