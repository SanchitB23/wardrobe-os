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
import { formatCurrency } from "@/types/wardrobe";

type SpendingChartItem = {
  id?: string | null;
  name: string;
  amount: number;
};

type SpendingChartProps = {
  title: string;
  description?: string;
  items: SpendingChartItem[];
  emptyMessage?: string;
};

export function SpendingChart({
  title,
  description,
  items,
  emptyMessage = "No spending data yet.",
}: SpendingChartProps) {
  const maxAmount = items.reduce(
    (max, item) => Math.max(max, item.amount),
    0,
  );

  return (
    <Card className="h-full">
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
                maxAmount > 0
                  ? Math.round((item.amount / maxAmount) * 100)
                  : 0;

              return (
                <li key={item.id ?? item.name}>
                  <Progress
                    value={percentage}
                    className="flex-col items-stretch gap-2"
                    aria-label={`${item.name}: ${formatCurrency(item.amount)}`}
                  >
                    <div className="flex items-center gap-2">
                      <ProgressLabel className="truncate">
                        {item.name}
                      </ProgressLabel>
                      <Badge variant="secondary" className="ml-auto tabular-nums">
                        {formatCurrency(item.amount)}
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
