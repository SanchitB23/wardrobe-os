"use client";

import React, { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlusIcon, SaveIcon, XIcon } from "lucide-react";

import { eachDateInclusive } from "@/domain/lifestyle";
import type { PlanningStrategy, TravelStyle, TripEvent } from "@/domain/lifestyle";
import type { TripCityLeg, TripSpec } from "@/domain/trips";
import { useSaveTripMutation, useTrip } from "@/features/trips/hooks";
import type { SaveTripInput } from "@/features/trips/types";
import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TRAVEL_STYLES: TravelStyle[] = ["minimal", "standard", "overpacker"];
const STRATEGIES: PlanningStrategy[] = ["minimal", "balanced", "luxury", "business"];
const LUGGAGE = ["carry_on", "checked", "unbounded"] as const;

const BLANK: TripSpec = {
  name: "",
  destination: "",
  startDate: "",
  endDate: "",
  cities: [],
  events: [],
  travelStyle: "standard",
  planningStrategy: "balanced",
  laundry: { available: false },
  luggage: { kind: "carry_on", maxItems: null },
  notes: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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

/** Wrapper: resolves edit state (loads the trip) before mounting the form. */
export function TripFormView({ tripId }: { tripId?: string }) {
  const editing = Boolean(tripId);
  const tripQuery = useTrip(tripId ?? "");

  if (editing && tripQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Loading trip…
          </CardContent>
        </Card>
      </div>
    );
  }

  const initial: TripSpec = editing && tripQuery.data ? tripQuery.data : BLANK;
  return <TripForm initial={initial} tripId={tripId} />;
}

function TripForm({ initial, tripId }: { initial: TripSpec; tripId?: string }) {
  const router = useRouter();
  const save = useSaveTripMutation();

  const [name, setName] = useState(initial.name ?? "");
  const [destination, setDestination] = useState(initial.destination ?? "");
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [travelStyle, setTravelStyle] = useState<TravelStyle>(initial.travelStyle);
  const [strategy, setStrategy] = useState<PlanningStrategy>(initial.planningStrategy);
  const [luggage, setLuggage] = useState<(typeof LUGGAGE)[number]>(initial.luggage.kind);
  const [maxItems, setMaxItems] = useState(
    initial.luggage.maxItems != null ? String(initial.luggage.maxItems) : "",
  );
  const [laundry, setLaundry] = useState(initial.laundry.available);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [events, setEvents] = useState<TripEvent[]>(initial.events);
  const [cities, setCities] = useState<TripCityLeg[]>(initial.cities);

  const dates = useMemo(
    () => (startDate && endDate ? eachDateInclusive(startDate, endDate) : []),
    [startDate, endDate],
  );
  const canSave =
    (destination.trim() !== "" || cities.length > 0) && dates.length > 0 && !save.isPending;

  async function onSave() {
    const input: SaveTripInput = {
      id: tripId,
      name: name.trim() || null,
      destination: destination.trim() || null,
      startDate,
      endDate,
      cities: cities.map((c, i) => ({ ...c, sortOrder: i })),
      events,
      travelStyle,
      planningStrategy: strategy,
      laundry: { available: laundry },
      luggage: {
        kind: luggage,
        maxItems: luggage === "carry_on" && maxItems ? Number(maxItems) : null,
      },
      notes: notes.trim() || null,
      isTemplate: false,
    };
    const trip = await save.mutateAsync(input);
    router.push(`/trips/${trip.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={tripId ? "Edit trip" : "New trip"}
        description="A trip is data. The Lifestyle Engine derives the plan from it — save now, plan any time."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trip details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goa long weekend" />
            </Field>
            <Field label="Destination">
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Goa"
              />
            </Field>
            <Field label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="End date">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
            <Field label="Travel style">
              <Select value={travelStyle} onValueChange={(v) => v && setTravelStyle(v as TravelStyle)}>
                <SelectTrigger className="w-full">
                  <span className="capitalize">{travelStyle}</span>
                </SelectTrigger>
                <SelectContent>
                  {TRAVEL_STYLES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Planning strategy">
              <Select value={strategy} onValueChange={(v) => v && setStrategy(v as PlanningStrategy)}>
                <SelectTrigger className="w-full">
                  <span className="capitalize">{strategy}</span>
                </SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Luggage">
              <Select value={luggage} onValueChange={(v) => v && setLuggage(v as (typeof LUGGAGE)[number])}>
                <SelectTrigger className="w-full">
                  <span>{luggage.replace("_", "-")}</span>
                </SelectTrigger>
                <SelectContent>
                  {LUGGAGE.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", "-")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {luggage === "carry_on" ? (
              <Field label="Max items (optional)">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={maxItems}
                  onChange={(e) => setMaxItems(e.target.value)}
                  placeholder="e.g. 10"
                />
              </Field>
            ) : null}
            <Field label="Laundry available?">
              <Button
                type="button"
                variant={laundry ? "default" : "outline"}
                onClick={() => setLaundry((v) => !v)}
                className="w-full justify-start"
              >
                {laundry ? "Yes — can wash on the trip" : "No"}
              </Button>
            </Field>
          </div>

          <Field label="Notes (optional)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember…" />
          </Field>

          <CitiesEditor cities={cities} onChange={setCities} />
          <EventsEditor dates={dates} events={events} onChange={setEvents} />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button disabled={!canSave} onClick={onSave}>
              {save.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save trip
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CitiesEditor({
  cities,
  onChange,
}: {
  cities: TripCityLeg[];
  onChange: (c: TripCityLeg[]) => void;
}) {
  const [city, setCity] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label className="text-xs text-muted-foreground">
        Cities (optional) — add 2+ for a multi-city itinerary; each leg gets its own weather
      </Label>
      {cities.length > 0 ? (
        <div className="space-y-1.5">
          {cities.map((c, i) => (
            <div key={`${c.city}-${i}`} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm">
              <span>
                <span className="font-medium">{c.city}</span>{" "}
                <span className="tabular-nums text-muted-foreground">
                  {c.startDate} → {c.endDate}
                </span>
              </span>
              <button type="button" aria-label="Remove city" onClick={() => onChange(cities.filter((_, j) => j !== i))}>
                <XIcon className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-36" />
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!city.trim() || !start || !end}
          onClick={() => {
            onChange([
              ...cities,
              { city: city.trim(), startDate: start, endDate: end, sortOrder: cities.length },
            ]);
            setCity("");
            setStart("");
            setEnd("");
          }}
        >
          <PlusIcon className="size-4" /> Add city
        </Button>
      </div>
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
              <button type="button" className="ml-1" onClick={() => onChange(events.filter((_, j) => j !== i))}>
                ×
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <Select value={date || undefined} onValueChange={(v) => v && setDate(v)}>
          <SelectTrigger className="w-40">
            <span>{date || "Date"}</span>
          </SelectTrigger>
          <SelectContent>
            {dates.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="Occasion (e.g. Wedding)" className="w-48" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!date || !occasion.trim()}
          onClick={() => {
            onChange([...events, { date, occasion: occasion.trim(), formalityHint: null }]);
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
