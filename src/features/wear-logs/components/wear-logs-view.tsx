"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlusIcon } from "lucide-react";

import type { WearLogSource } from "@/domain/wear-logs";
import { PageHeader } from "@/features/layout";
import {
  useDeleteWearLogEventMutation,
  useWearLogEvents,
} from "@/features/wear-logs/hooks";
import { formatWearLogDisplayDate } from "@/features/wear-logs/services/wear-logs.service";
import type { WearEventListFilters } from "@/features/wear-logs/services/wear-events.service";
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

const SOURCE_LABEL: Record<WearLogSource, string> = {
  ad_hoc: "Ad-hoc",
  outfit: "Saved outfit",
  recommendation: "Recommendation",
  trip: "Trip",
  ai: "AI",
};

export function WearLogsView() {
  const router = useRouter();
  const [source, setSource] = useState<WearLogSource | "all">("all");
  const [linkage, setLinkage] = useState<"all" | "linked" | "unlinked">("all");
  const [wornFrom, setWornFrom] = useState("");
  const [wornTo, setWornTo] = useState("");

  const filters: WearEventListFilters = useMemo(
    () => ({
      source,
      linkage,
      wornFrom: wornFrom || undefined,
      wornTo: wornTo || undefined,
    }),
    [source, linkage, wornFrom, wornTo],
  );

  const query = useWearLogEvents(filters);
  const deleteMutation = useDeleteWearLogEventMutation();
  const events = query.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Wear Logs"
        badge={<Badge variant="secondary">History</Badge>}
        description="What you actually wore — separate from curated Saved Outfits."
        actions={
          <Button render={<Link href="/wear-logs/new" />}>
            <PlusIcon className="size-4" />
            Quick Log Wear
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filters</CardTitle>
          <CardDescription>Source, outfit link, and date range.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Source</Label>
            <Select
              value={source}
              onValueChange={(v) =>
                setSource((v ?? "all") as WearLogSource | "all")
              }
            >
              <SelectTrigger className="w-40 capitalize">
                <span className="flex flex-1 text-left capitalize">{source}</span>
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    "all",
                    "ad_hoc",
                    "outfit",
                    "recommendation",
                    "trip",
                    "ai",
                  ] as const
                ).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s === "all" ? "All" : SOURCE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Outfit link</Label>
            <Select
              value={linkage}
              onValueChange={(v) =>
                setLinkage((v ?? "all") as "all" | "linked" | "unlinked")
              }
            >
              <SelectTrigger className="w-36 capitalize">
                <span className="flex flex-1 text-left capitalize">{linkage}</span>
              </SelectTrigger>
              <SelectContent>
                {(["all", "linked", "unlinked"] as const).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              className="w-40"
              value={wornFrom}
              onChange={(e) => setWornFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              className="w-40"
              value={wornTo}
              onChange={(e) => setWornTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {query.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Loading wear logs…
          </CardContent>
        </Card>
      ) : null}

      {query.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {query.error.message || "Couldn't load wear logs."}
          </CardContent>
        </Card>
      ) : null}

      {query.data && events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="space-y-3 py-12 text-center text-sm text-muted-foreground">
            <p>No wear logs yet. Log what you wore without creating an outfit.</p>
            <Button render={<Link href="/wear-logs/new" />}>
              Quick Log Wear
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {events.map((event) => (
          <Card key={event.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {formatWearLogDisplayDate(event.wornOn)}
                  </p>
                  <Badge variant="outline">{SOURCE_LABEL[event.source]}</Badge>
                  {event.outfitId ? (
                    <Badge variant="secondary">Linked outfit</Badge>
                  ) : (
                    <Badge variant="outline">Unlinked</Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {event.items.length} item
                    {event.items.length === 1 ? "" : "s"}
                  </span>
                </div>
                {event.notes ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {event.notes}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/wear-logs/${event.id}`)}
                >
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Delete this wear log? This does not delete any saved outfit.",
                      )
                    ) {
                      deleteMutation.mutate(event.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
