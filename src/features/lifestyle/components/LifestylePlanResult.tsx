"use client";

import { AlertTriangleIcon, SparklesIcon } from "lucide-react";

import type { LifestyleResult } from "@/features/lifestyle/services/LifestyleService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function LifestylePlanResult({ result }: { result: LifestyleResult }) {
  const { plan, itemNames } = result;
  const nameOf = (id: string) => itemNames[id] ?? id;
  const { tripPlan, packingPlan, laundryPlan, shoppingPlan } = plan;

  return (
    <div className="space-y-4">
      {/* Header: score + confidence + trade-offs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {plan.metadata.destination} · {plan.metadata.days} day{plan.metadata.days === 1 ? "" : "s"}
              </CardTitle>
              <CardDescription className="capitalize">
                {plan.metadata.strategy} strategy · weather: {plan.metadata.weatherSource}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-semibold tabular-nums">{plan.planScore}</div>
                <div className="text-xs text-muted-foreground">plan score</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold tabular-nums">{pct(packingPlan.packingConfidence)}</div>
                <div className="text-xs text-muted-foreground">packing confidence</div>
              </div>
              <Button variant="outline" size="sm" disabled title="AI explanation — coming soon">
                <SparklesIcon /> Explain
              </Button>
            </div>
          </div>
        </CardHeader>
        {plan.tradeoffs.length > 0 || plan.warnings.length > 0 ? (
          <CardContent className="space-y-2">
            {plan.tradeoffs.map((t, i) => (
              <p key={`t${i}`} className="text-sm text-muted-foreground">· {t}</p>
            ))}
            {plan.warnings.map((w, i) => (
              <p key={`w${i}`} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" /> {w}
              </p>
            ))}
          </CardContent>
        ) : null}
      </Card>

      {/* Daily outfits */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daily outfits</CardTitle>
          <CardDescription>
            Capsule: {tripPlan.capsule.itemCount} items cover {tripPlan.capsule.dayCount} days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tripPlan.dailyOutfits.map((o) => (
            <div key={o.date} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium tabular-nums">{o.date}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline">{o.occasion}</Badge>
                  <Badge variant="secondary" className="capitalize">{o.weather.condition}</Badge>
                  {o.uncovered ? <Badge variant="destructive">uncovered</Badge> : null}
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {o.uncovered ? o.reason : o.itemIds.map(nameOf).join(" · ")}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Packing list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Packing list</CardTitle>
            <CardDescription>
              {packingPlan.packingList.count} items{packingPlan.packingList.withinLuggage ? "" : " — over limit"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(packingPlan.packingList.bySlot).map(([slot, ids]) => (
              <div key={slot}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground/70">{slot}</div>
                <div className="text-sm">{ids.map(nameOf).join(", ")}</div>
              </div>
            ))}
            <Separator />
            <Progress value={Math.round(packingPlan.packingConfidence * 100)} className="h-1.5" />
            <div className="text-xs text-muted-foreground">{pct(packingPlan.packingConfidence)} of days fully packable</div>
          </CardContent>
        </Card>

        {/* Laundry */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Laundry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!laundryPlan.schedule.needed ? (
              <p className="text-muted-foreground">No laundry needed — your packed clothes last the trip.</p>
            ) : laundryPlan.schedule.washOn.length > 0 ? (
              <p>Wash on: {laundryPlan.schedule.washOn.join(", ")}.</p>
            ) : (
              <p className="text-amber-700 dark:text-amber-400">Laundry needed but unavailable — pack more.</p>
            )}
            {laundryPlan.schedule.reWears.length > 0 ? (
              <p className="text-muted-foreground">
                {laundryPlan.schedule.reWears.length} item(s) re-worn across days.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Shopping suggestions */}
      {shoppingPlan.missingItems.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Missing items &amp; shopping</CardTitle>
            <CardDescription>Needs your wardrobe can&apos;t cover — with a buy/skip verdict.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {shoppingPlan.missingItems.map((m) => {
              const suggestion = shoppingPlan.shoppingSuggestions.find((s) => s.need === m.need);
              return (
                <div key={m.need} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                  <div>
                    <div className="text-sm font-medium">{m.need}</div>
                    <div className="text-xs text-muted-foreground">{m.reason}</div>
                  </div>
                  {suggestion ? (
                    <Badge variant="outline" className="capitalize">{suggestion.analysis.decision}</Badge>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
