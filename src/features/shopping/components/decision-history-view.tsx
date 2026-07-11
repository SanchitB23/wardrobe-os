"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";

import type { BuyDecision } from "@/domain/acquisition";
import { useDecisions } from "@/features/shopping/hooks";
import type { DecisionListFilters } from "@/features/shopping/types";
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

const decisionVariant = (d: string) =>
  d === "buy" ? "default" : d === "consider" ? "secondary" : "outline";

export function DecisionHistoryView() {
  const [decision, setDecision] = useState<BuyDecision | "all">("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filters: DecisionListFilters = useMemo(
    () => ({
      decision,
      search: search.trim() || undefined,
      from: from || null,
      to: to || null,
    }),
    [decision, search, from, to],
  );

  const query = useDecisions(filters);
  const rows = query.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Decision History"
        badge={<Badge variant="secondary">Acquisitions</Badge>}
        description="Stored Buy vs Skip analyses. Filter and search — the engine is unchanged; every run is snapshotted silently."
        actions={
          <Button variant="outline" render={<Link href="/acquisitions" />}>
            Hub
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filters</CardTitle>
          <CardDescription>
            Decision, date range, and free-text search.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Decision</Label>
            <Select
              value={decision}
              onValueChange={(v) =>
                setDecision((v ?? "all") as BuyDecision | "all")
              }
            >
              <SelectTrigger className="w-36 capitalize">
                <span className="flex flex-1 text-left capitalize">
                  {decision}
                </span>
              </SelectTrigger>
              <SelectContent>
                {(["all", "buy", "consider", "skip"] as const).map((d) => (
                  <SelectItem key={d} value={d} className="capitalize">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or summary…"
            />
          </div>
        </CardContent>
      </Card>

      {query.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Loading decisions…
          </CardContent>
        </Card>
      ) : null}

      {query.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {query.error.message ||
              "Couldn't load decisions. Has the acquisitions migration been applied?"}
          </CardContent>
        </Card>
      ) : null}

      {query.data && rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No matching decisions. Run Buy vs Skip to build history.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        {rows.map((r) => {
          const open = expanded === r.id;
          return (
            <Card key={r.id}>
              <CardContent className="py-3">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => setExpanded(open ? null : r.id)}
                >
                  <div className="flex items-start gap-2">
                    {open ? (
                      <ChevronDownIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {r.itemName}
                        </span>
                        <Badge
                          variant={decisionVariant(r.decision)}
                          className="capitalize"
                        >
                          {r.decision}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.itemCategory ?? "—"} · score {r.score ?? "—"} ·{" "}
                        {r.createdAt.slice(0, 10)}
                      </div>
                      {r.summary ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.summary}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
                {open ? (
                  <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed">
                    {JSON.stringify(r.analysis, null, 2)}
                  </pre>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
