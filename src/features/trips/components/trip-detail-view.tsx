"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  CheckIcon,
  CloudSunIcon,
  Loader2Icon,
  PencilIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react";

import { useLifestyleExplanation } from "@/features/lifestyle/hooks/useLifestyleExplanation";
import { useSetPackingProgressMutation, useTripPlan } from "@/features/trips/hooks";
import type { TripPlanView } from "@/features/trips/types";
import { PageHeader } from "@/features/layout";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TripDetailView({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const planQuery = useTripPlan(tripId);

  async function refreshWeather() {
    await queryClient.invalidateQueries({ queryKey: wardrobeKeys.tripPlan(tripId) });
  }

  if (planQuery.isPending) {
    return (
      <Shell>
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Building the plan…
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (planQuery.isError || !planQuery.data) {
    return (
      <Shell>
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {planQuery.error?.message || "Couldn't load this trip."}
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return <TripDetail view={planQuery.data} tripId={tripId} onRefreshWeather={refreshWeather} refreshing={planQuery.isFetching} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function TripDetail({
  view,
  tripId,
  onRefreshWeather,
  refreshing,
}: {
  view: TripPlanView;
  tripId: string;
  onRefreshWeather: () => void;
  refreshing: boolean;
}) {
  const { trip, plan, itemNames, timeline, packingChecklist, weather } = view;
  const nameOf = (id: string) => itemNames[id] ?? id;

  const explain = useLifestyleExplanation();
  const [explainOpen, setExplainOpen] = useState(false);
  function onExplain() {
    setExplainOpen((v) => (explain.data ? !v : true));
    if (!explain.data && !explain.isPending) explain.mutate(plan);
  }

  return (
    <Shell>
      <PageHeader
        title={trip.name || trip.destination || "Trip"}
        badge={<Badge variant="secondary">Travel</Badge>}
        breadcrumb={
          <Link href="/trips" className="text-sm text-muted-foreground hover:underline">
            ← All trips
          </Link>
        }
        description={`${trip.startDate} → ${trip.endDate}${trip.destination ? ` · ${trip.destination}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onRefreshWeather} disabled={refreshing}>
              {refreshing ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} Refresh weather
            </Button>
            <Button variant="outline" size="sm" render={<Link href={`/trips/${tripId}/edit`} />}>
              <PencilIcon /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onExplain} disabled={explain.isPending}>
              {explain.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
              {explain.data ? (explainOpen ? "Hide" : "Explain") : "Explain"}
            </Button>
          </div>
        }
      />

      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CloudSunIcon className="size-4" /> weather: {weather.source}
              <span aria-hidden>·</span> {plan.metadata.days} day{plan.metadata.days === 1 ? "" : "s"}
              <Badge variant="outline" className="capitalize">{plan.metadata.strategy}</Badge>
            </div>
            <div className="flex items-center gap-4">
              <Stat value={String(plan.planScore)} label="plan score" />
              <Stat value={pct(plan.packingPlan.packingConfidence)} label="packing confidence" />
              <Stat value={`${packingChecklist.packed}/${packingChecklist.total}`} label="packed" />
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

      {explainOpen && explain.data ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <SparklesIcon className="size-4" /> AI explanation
            </CardTitle>
            <CardDescription>AI narrates the deterministic plan — it never changes it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{explain.data.explanation.summary}</p>
            {explain.data.explanation.packingStrategy ? (
              <p className="text-muted-foreground">{explain.data.explanation.packingStrategy}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="packing">Packing</TabsTrigger>
          <TabsTrigger value="laundry">Laundry</TabsTrigger>
          <TabsTrigger value="shopping">Shopping</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Outfit calendar</CardTitle>
              <CardDescription>
                Capsule: {plan.tripPlan.capsule.itemCount} items cover {plan.tripPlan.capsule.dayCount} days.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {timeline.map((day) => (
                <div key={day.date} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium tabular-nums">
                      {day.date}
                      {day.city ? <span className="ml-2 text-muted-foreground">{day.city}</span> : null}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline">{day.occasion}</Badge>
                      <Badge variant="secondary" className="capitalize">{day.weather.condition}</Badge>
                      {day.uncovered ? <Badge variant="destructive">uncovered</Badge> : null}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {day.outfitItemIds.length > 0
                      ? day.outfitItemIds.map(nameOf).join(" · ")
                      : "No outfit could be assembled for this day."}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packing">
          <PackingTab view={view} tripId={tripId} />
        </TabsContent>

        <TabsContent value="laundry">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Laundry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!plan.laundryPlan.schedule.needed ? (
                <p className="text-muted-foreground">No laundry needed — your packed clothes last the trip.</p>
              ) : plan.laundryPlan.schedule.washOn.length > 0 ? (
                <p>Wash on: {plan.laundryPlan.schedule.washOn.join(", ")}.</p>
              ) : (
                <p className="text-amber-700 dark:text-amber-400">Laundry needed but unavailable — pack more.</p>
              )}
              {plan.laundryPlan.schedule.reWears.length > 0 ? (
                <p className="text-muted-foreground">
                  {plan.laundryPlan.schedule.reWears.length} item(s) re-worn across days.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shopping">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Shopping before the trip</CardTitle>
              <CardDescription>Needs your wardrobe can&apos;t cover — with a buy/skip verdict.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {plan.shoppingPlan.missingItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing to buy — your wardrobe covers this trip.</p>
              ) : (
                plan.shoppingPlan.missingItems.map((m) => {
                  const suggestion = plan.shoppingPlan.shoppingSuggestions.find((s) => s.need === m.need);
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
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-right">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PackingTab({ view, tripId }: { view: TripPlanView; tripId: string }) {
  const { packingChecklist, plan } = view;
  const setPacked = useSetPackingProgressMutation(tripId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Packing checklist</CardTitle>
        <CardDescription>
          {packingChecklist.packed} / {packingChecklist.total} packed
          {plan.packingPlan.packingList.withinLuggage ? "" : " — over luggage limit"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress
          value={packingChecklist.total > 0 ? Math.round((packingChecklist.packed / packingChecklist.total) * 100) : 0}
          aria-label="Packing progress"
          className="h-1.5"
        />
        {Object.entries(packingChecklist.bySlot).map(([slot, entries]) => (
          <div key={slot} className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground/70">{slot}</div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {entries.map((entry) => (
                <button
                  key={entry.itemId}
                  type="button"
                  disabled={setPacked.isPending}
                  onClick={() => setPacked.mutate({ itemId: entry.itemId, packed: !entry.packed })}
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm hover:bg-muted"
                  aria-pressed={entry.packed}
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                      entry.packed ? "border-primary bg-primary text-primary-foreground" : "border-input"
                    }`}
                    aria-hidden
                  >
                    {entry.packed ? <CheckIcon className="size-3" /> : null}
                  </span>
                  <span className={entry.packed ? "text-muted-foreground line-through" : ""}>{entry.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {packingChecklist.total === 0 ? (
          <>
            <Separator />
            <p className="text-sm text-muted-foreground">No items to pack for this plan.</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
