"use client";

import { useState } from "react";
import { AlertTriangleIcon, Loader2Icon, SparklesIcon } from "lucide-react";

import type { LifestylePlanExplanation } from "@/ai/schemas/LifestylePlanExplanation.schema";
import type { LifestyleResult } from "@/features/lifestyle/services/LifestyleService";
import { useLifestyleExplanation } from "@/features/lifestyle/hooks/useLifestyleExplanation";
import { useDevMode } from "@/features/layout";
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

  const explain = useLifestyleExplanation();
  const { devMode } = useDevMode();
  const [open, setOpen] = useState(false);

  function onExplain() {
    setOpen((v) => (explain.data ? !v : true));
    if (!explain.data && !explain.isPending) explain.mutate(plan);
  }

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
              <Button variant="outline" size="sm" onClick={onExplain} disabled={explain.isPending}>
                {explain.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                {explain.isPending ? "Explaining…" : explain.data ? (open ? "Hide" : "Explain") : "Explain"}
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

      {/* AI explanation (expandable) — explains the deterministic plan, never changes it. */}
      {open ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <SparklesIcon className="size-4" /> AI explanation
              </CardTitle>
              {devMode && explain.data?.cached ? (
                <Badge variant="outline" className="text-[10px]">cache hit</Badge>
              ) : null}
            </div>
            <CardDescription>AI narrates the plan — it never changes it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {explain.isPending ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> Writing the explanation…
              </p>
            ) : null}
            {explain.isError ? (
              <p className="text-destructive">
                {explain.error.message || "Couldn't explain the plan."}{" "}
                <button type="button" className="underline" onClick={() => explain.mutate(plan)}>
                  Retry
                </button>
              </p>
            ) : null}
            {explain.data ? <ExplanationBody explanation={explain.data.explanation} /> : null}
          </CardContent>
        </Card>
      ) : null}

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
            <Progress value={Math.round(packingPlan.packingConfidence * 100)} aria-label="Packing confidence" className="h-1.5" />
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

function Para({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">{title}</div>
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">{title}</div>
      <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function ExplanationBody({ explanation }: { explanation: LifestylePlanExplanation }) {
  return (
    <div className="space-y-3">
      <p>{explanation.summary}</p>
      <Para title="Packing strategy" text={explanation.packingStrategy} />
      <List title="Daily highlights" items={explanation.dailyHighlights} />
      <List title="Packing tips" items={explanation.packingTips} />
      <Para title="Trade-offs" text={explanation.tradeoffExplanation} />
      <Para title="Shopping advice" text={explanation.shoppingAdvice} />
      <Para title="Risk assessment" text={explanation.riskAssessment} />
      <Para title="Confidence" text={explanation.confidenceExplanation} />
      <List title="Travel tips" items={explanation.travelTips} />
    </div>
  );
}
