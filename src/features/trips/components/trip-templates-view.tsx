"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, WandSparklesIcon } from "lucide-react";

import { TRIP_TEMPLATES } from "@/domain/trips";
import { useCreateFromTemplateMutation } from "@/features/trips/hooks";
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

export function TripTemplatesView() {
  const router = useRouter();
  const create = useCreateFromTemplateMutation();
  const [startDates, setStartDates] = useState<Record<string, string>>({});
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);

  async function applyTemplate(id: string) {
    const startDate = startDates[id];
    if (!startDate) return;
    setPending(id);
    try {
      const trip = await create.mutateAsync({
        templateId: id,
        startDate,
        destination: destinations[id]?.trim() || null,
      });
      router.push(`/trips/${trip.id}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Trip templates"
        badge={<Badge variant="secondary">Travel</Badge>}
        description="Reusable starting points. Pick a start date (and optional destination) — the template becomes a saved trip you can edit and plan."
        actions={
          <Button variant="outline" render={<Link href="/trips">Back to trips</Link>} />
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {TRIP_TEMPLATES.map((t) => (
          <Card key={t.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.name}</CardTitle>
              <CardDescription>{t.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{t.durationDays} days</Badge>
                <Badge variant="secondary" className="capitalize">
                  {t.travelStyle}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {t.planningStrategy}
                </Badge>
                {t.laundryAvailable ? <Badge variant="outline">laundry</Badge> : null}
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Start date</Label>
                  <Input
                    type="date"
                    value={startDates[t.id] ?? ""}
                    onChange={(e) => setStartDates((s) => ({ ...s, [t.id]: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Destination (optional)</Label>
                  <Input
                    value={destinations[t.id] ?? ""}
                    onChange={(e) => setDestinations((s) => ({ ...s, [t.id]: e.target.value }))}
                    placeholder="e.g. Lisbon"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!startDates[t.id] || pending === t.id}
                  onClick={() => applyTemplate(t.id)}
                >
                  {pending === t.id ? <Loader2Icon className="animate-spin" /> : <WandSparklesIcon />} Create
                  trip
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
