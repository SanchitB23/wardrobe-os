"use client";

import React, { useId, useMemo, useState } from "react";
import { Loader2Icon, LuggageIcon, SparklesIcon } from "lucide-react";

import { eachDateInclusive } from "@/domain/lifestyle";
import type {
  PlanningStrategy,
  TravelStyle,
  TripEvent,
  WeatherForecastDay,
} from "@/domain/lifestyle";
import type { WeatherCondition } from "@/domain/recommendation";
import { seasonFor } from "@/runtime/weather/WeatherNormalizer";
import { useLifestylePlan } from "@/features/lifestyle/hooks/useLifestylePlan";
import { LifestylePlanResult } from "@/features/lifestyle/components/LifestylePlanResult";
import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const TRAVEL_STYLES: TravelStyle[] = ["minimal", "standard", "overpacker"];
const STRATEGIES: PlanningStrategy[] = ["minimal", "balanced", "luxury", "business"];
const LUGGAGE = ["carry_on", "checked", "unbounded"] as const;
const CONDITIONS: WeatherCondition[] = ["hot", "warm", "mild", "cool", "cold", "rainy"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // Associate the visible label with the control (RFC-009/H10): the label gets an
  // id and the child is given aria-labelledby, which works for both <Input> and
  // the Base UI Select trigger.
  const labelId = useId();
  return (
    <div className="space-y-1.5">
      <Label id={labelId} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(
            children as React.ReactElement<{ "aria-labelledby"?: string }>,
            { "aria-labelledby": labelId },
          )
        : children}
    </div>
  );
}

export function LifestyleTripView() {
  const [step, setStep] = useState(1);
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travelStyle, setTravelStyle] = useState<TravelStyle>("standard");
  const [strategy, setStrategy] = useState<PlanningStrategy>("balanced");
  const [luggage, setLuggage] = useState<(typeof LUGGAGE)[number]>("carry_on");
  const [maxItems, setMaxItems] = useState("");
  const [laundry, setLaundry] = useState(false);
  const [events, setEvents] = useState<TripEvent[]>([]);
  const [weatherMode, setWeatherMode] = useState<"auto" | "manual">("auto");
  const [manual, setManual] = useState<Record<string, WeatherCondition>>({});

  const plan = useLifestylePlan();

  const dates = useMemo(
    () => (startDate && endDate ? eachDateInclusive(startDate, endDate) : []),
    [startDate, endDate],
  );
  const canProceed = destination.trim() !== "" && dates.length > 0;

  function generate() {
    const manualDays: WeatherForecastDay[] = dates.map((date) => {
      const condition = manual[date] ?? "mild";
      return {
        date,
        // Manual entry has no coordinates, so assume northern hemisphere (lat 0);
        // reuses the single hemisphere-aware season mapping (RFC-009/M15).
        season: seasonFor(date, 0),
        condition,
        highC: null,
        lowC: null,
        rainRisk: condition === "rainy" ? 0.8 : 0,
      };
    });
    plan.mutate({
      trip: {
        destination: destination.trim(),
        startDate,
        endDate,
        events,
        travelStyle,
        laundry: { available: laundry },
        luggage: {
          kind: luggage,
          maxItems: luggage === "carry_on" && maxItems ? Number(maxItems) : null,
        },
      },
      strategy,
      weather: weatherMode === "manual" ? { mode: "manual", days: manualDays } : { mode: "auto" },
    });
    setStep(3);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Trip Planner"
        badge={<Badge variant="secondary">Lifestyle</Badge>}
        description="Plan a trip deterministically: per-day outfits, a packing list, a capsule, laundry, and what's missing — composed from your wardrobe across the trip. The engine plans; AI only explains."
      />

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {["Trip", "Weather", "Plan"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={step === i + 1 ? "font-semibold text-foreground" : ""}>
              {i + 1}. {s}
            </span>
            {i < 2 ? <span aria-hidden>→</span> : null}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1 · Trip details</CardTitle>
            <CardDescription>Where, when, and how you like to pack.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Destination">
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Bangalore" />
              </Field>
              <Field label="Travel style">
                <Select value={travelStyle} onValueChange={(v) => v && setTravelStyle(v as TravelStyle)}>
                  <SelectTrigger className="w-full"><span className="capitalize">{travelStyle}</span></SelectTrigger>
                  <SelectContent>{TRAVEL_STYLES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Start date"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
              <Field label="End date"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
              <Field label="Planning strategy">
                <Select value={strategy} onValueChange={(v) => v && setStrategy(v as PlanningStrategy)}>
                  <SelectTrigger className="w-full"><span className="capitalize">{strategy}</span></SelectTrigger>
                  <SelectContent>{STRATEGIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Luggage">
                <Select value={luggage} onValueChange={(v) => v && setLuggage(v as (typeof LUGGAGE)[number])}>
                  <SelectTrigger className="w-full"><span>{luggage.replace("_", "-")}</span></SelectTrigger>
                  <SelectContent>{LUGGAGE.map((s) => <SelectItem key={s} value={s}>{s.replace("_", "-")}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              {luggage === "carry_on" ? (
                <Field label="Max items (optional)"><Input type="number" inputMode="numeric" value={maxItems} onChange={(e) => setMaxItems(e.target.value)} placeholder="e.g. 10" /></Field>
              ) : null}
              <Field label="Laundry available?">
                <Button type="button" variant={laundry ? "default" : "outline"} onClick={() => setLaundry((v) => !v)} className="w-full justify-start">
                  {laundry ? "Yes — can wash on the trip" : "No"}
                </Button>
              </Field>
            </div>

            <EventsEditor dates={dates} events={events} onChange={setEvents} />

            <div className="flex justify-end">
              <Button disabled={!canProceed} onClick={() => setStep(2)}><LuggageIcon /> Next: Weather</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2 · Weather</CardTitle>
            <CardDescription>Fetch a forecast automatically, or enter it by hand.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant={weatherMode === "auto" ? "default" : "outline"} size="sm" onClick={() => setWeatherMode("auto")}>Auto (Open-Meteo)</Button>
              <Button variant={weatherMode === "manual" ? "default" : "outline"} size="sm" onClick={() => setWeatherMode("manual")}>Manual</Button>
            </div>
            {weatherMode === "manual" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {dates.map((date) => (
                  <div key={date} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                    <span className="text-sm tabular-nums">{date}</span>
                    <Select value={manual[date] ?? "mild"} onValueChange={(v) => v && setManual((m) => ({ ...m, [date]: v as WeatherCondition }))}>
                      <SelectTrigger className="w-32"><span className="capitalize">{manual[date] ?? "mild"}</span></SelectTrigger>
                      <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">A daily forecast for {destination || "your destination"} will be fetched when you generate the plan. If it can&apos;t be reached, a neutral forecast is used.</p>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={generate}><SparklesIcon /> Generate plan</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setStep(2)}>Back</Button>
            {plan.data ? <Button variant="outline" size="sm" onClick={generate}><SparklesIcon /> Regenerate</Button> : null}
          </div>
          {plan.isPending ? (
            <Card><CardContent className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2Icon className="size-5 animate-spin" /> Planning your trip…</CardContent></Card>
          ) : null}
          {plan.isError ? (
            <Card className="border-destructive/30"><CardContent className="py-8 text-center text-sm text-destructive">{plan.error.message || "Couldn't build the plan."}</CardContent></Card>
          ) : null}
          {plan.data ? <LifestylePlanResult result={plan.data} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function EventsEditor({
  dates,
  events,
  onChange,
}: {
  dates: string[];
  events: TripEvent[];
  onChange: (e: TripEvent[]) => void;
}) {
  const [date, setDate] = useState("");
  const [occasion, setOccasion] = useState("");
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label className="text-xs text-muted-foreground">Events (optional) — days with a specific occasion</Label>
      {events.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {events.map((e, i) => (
            <Badge key={`${e.date}-${i}`} variant="secondary" className="gap-1">
              {e.date}: {e.occasion}
              <button type="button" className="ml-1" onClick={() => onChange(events.filter((_, j) => j !== i))}>×</button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <Select value={date || undefined} onValueChange={(v) => v && setDate(v)}>
          <SelectTrigger className="w-40"><span>{date || "Date"}</span></SelectTrigger>
          <SelectContent>{dates.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
        <Input value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="Occasion (e.g. Wedding)" className="w-48" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!date || !occasion.trim()}
          onClick={() => {
            onChange([...events, { date, occasion: occasion.trim() }]);
            setDate("");
            setOccasion("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
