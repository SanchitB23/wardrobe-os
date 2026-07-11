"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";

import {
  useBackfillVisualAnalysisMutation,
  useVisualBackfillCandidates,
} from "@/features/inventory/hooks";
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

export function InventoryImageBackfillView() {
  const candidates = useVisualBackfillCandidates();
  const backfill = useBackfillVisualAnalysisMutation();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = candidates.data ?? [];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(rows.map((r) => r.itemId)));
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Inventory Image Backfill"
        badge={<Badge variant="secondary">Developer</Badge>}
        description="Batch-analyze primary photos into pending visual attributes. Accept/Reject still happens per item — never auto-accept."
        actions={
          <Button variant="outline" render={<Link href="/developer" />}>
            Developer hub
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Candidates</CardTitle>
          <CardDescription>
            Primary image present; missing accepted visual attrs (or stale /
            rejected).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={selectAll} disabled={!rows.length}>
              Select all
            </Button>
            <Button
              size="sm"
              disabled={selected.size === 0 || backfill.isPending}
              onClick={() => backfill.mutate([...selected])}
            >
              {backfill.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : null}
              Analyze selected ({selected.size})
            </Button>
          </div>

          {candidates.isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Loading…
            </p>
          ) : null}

          {rows.length === 0 && !candidates.isPending ? (
            <p className="text-sm text-muted-foreground">
              No backfill candidates right now.
            </p>
          ) : null}

          <ul className="space-y-1">
            {rows.map((row) => (
              <li
                key={row.itemId}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(row.itemId)}
                    onChange={() => toggle(row.itemId)}
                  />
                  <span className="truncate">{row.name}</span>
                </label>
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto px-0"
                  render={<Link href={`/inventory/${row.itemId}`} />}
                >
                  Open
                </Button>
              </li>
            ))}
          </ul>

          {backfill.data ? (
            <p className="text-sm text-muted-foreground">
              Done: {backfill.data.ok.length} ok, {backfill.data.failed.length}{" "}
              failed. Review pending proposals on each item detail page.
            </p>
          ) : null}
          {backfill.isError ? (
            <p className="text-sm text-destructive">{backfill.error.message}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
