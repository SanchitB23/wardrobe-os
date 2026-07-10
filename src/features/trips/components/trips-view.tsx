"use client";

import Link from "next/link";
import {
  CopyIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  LuggageIcon,
  MapPinIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import type { TripRecord } from "@/features/trips/types";
import {
  useCloneTripMutation,
  useDeleteTripMutation,
  useTrips,
} from "@/features/trips/hooks";
import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dateRange(trip: TripRecord) {
  return trip.startDate === trip.endDate
    ? trip.startDate
    : `${trip.startDate} → ${trip.endDate}`;
}

export function TripsView() {
  const trips = useTrips();
  const clone = useCloneTripMutation();
  const del = useDeleteTripMutation();

  const today = todayIso();
  const all = trips.data ?? [];
  const upcoming = all.filter((t) => t.endDate >= today);
  const past = all.filter((t) => t.endDate < today);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Trips"
        badge={<Badge variant="secondary">Travel</Badge>}
        description="Plan, save, and re-run trips. Each trip is data — the Lifestyle Engine derives the packing list, per-day outfits, laundry, and shopping. The engine plans; AI only explains."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/trips/templates" />}>
              <LayoutTemplateIcon /> Templates
            </Button>
            <Button render={<Link href="/trips/new" />}>
              <PlusIcon /> New trip
            </Button>
          </div>
        }
      />

      {trips.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Loading trips…
          </CardContent>
        </Card>
      ) : null}

      {trips.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {trips.error.message || "Couldn't load trips."}
          </CardContent>
        </Card>
      ) : null}

      {trips.data && all.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <LuggageIcon className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No trips yet. Create one from scratch or start from a template.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" render={<Link href="/trips/templates" />}>
                Browse templates
              </Button>
              <Button render={<Link href="/trips/new" />}>New trip</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {upcoming.length > 0 ? (
        <TripSection
          heading="Upcoming"
          trips={upcoming}
          onClone={(t) => clone.mutate({ id: t.id, newStartDate: t.startDate })}
          onDelete={(t) => del.mutate(t.id)}
          busy={clone.isPending || del.isPending}
        />
      ) : null}

      {past.length > 0 ? (
        <TripSection
          heading="History"
          trips={past}
          onClone={(t) => clone.mutate({ id: t.id, newStartDate: t.startDate })}
          onDelete={(t) => del.mutate(t.id)}
          busy={clone.isPending || del.isPending}
        />
      ) : null}
    </div>
  );
}

function TripSection({
  heading,
  trips,
  onClone,
  onDelete,
  busy,
}: {
  heading: string;
  trips: TripRecord[];
  onClone: (t: TripRecord) => void;
  onDelete: (t: TripRecord) => void;
  busy: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{heading}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((trip) => (
          <Card key={trip.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <Link href={`/trips/${trip.id}`} className="hover:underline">
                  {trip.name || trip.destination || "Untitled trip"}
                </Link>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {trip.destination ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="size-3" /> {trip.destination}
                  </span>
                ) : null}
                {trip.cities.length >= 2 ? (
                  <Badge variant="outline" className="text-[10px]">
                    {trip.cities.length} cities
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-3">
              <div className="space-y-2">
                <p className="text-sm tabular-nums">{dateRange(trip)}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="capitalize">
                    {trip.travelStyle}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {trip.planningStrategy}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Button size="sm" variant="ghost" render={<Link href={`/trips/${trip.id}`} />}>
                  Open plan
                </Button>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Clone trip"
                    disabled={busy}
                    onClick={() => onClone(trip)}
                  >
                    <CopyIcon className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete trip"
                    disabled={busy}
                    onClick={() => onDelete(trip)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
