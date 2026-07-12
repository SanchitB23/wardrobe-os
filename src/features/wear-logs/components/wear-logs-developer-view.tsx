"use client";

import { CalendarDaysIcon } from "lucide-react";

import { PageHeader, useDevMode } from "@/features/layout";
import { useWearDeveloperInsights } from "@/features/wear-logs/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function WearLogsDeveloperView() {
  const { devMode, toggle } = useDevMode();
  const query = useWearDeveloperInsights();
  const data = query.data;

  if (!devMode) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Enable Developer Mode to inspect wear log sources and promotion candidates.
        </p>
        <Button className="mt-4" size="sm" onClick={toggle}>
          Enable Developer Mode
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Wear Logs Runtime"
        badge={<Badge variant="secondary">Dev</Badge>}
        description="RFC-023 — wear source distribution, combination frequency, and promotion candidates (threshold ≥ 3, non-outfit)."
      />

      {query.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {query.isError ? (
        <p className="text-sm text-destructive">{query.error.message}</p>
      ) : null}

      {data ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDaysIcon className="size-4" /> Wear source
              </CardTitle>
              <CardDescription>Counts by wear_events.source</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm">
              {(Object.keys(data.bySource) as Array<keyof typeof data.bySource>).map(
                (source) => (
                  <div key={source} className="rounded-md border px-3 py-2">
                    <div className="text-xs uppercase text-muted-foreground">
                      {source}
                    </div>
                    <div className="font-semibold tabular-nums">
                      {data.bySource[source]}
                    </div>
                  </div>
                ),
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Combination frequency</CardTitle>
              <CardDescription>Top combination keys by wear count</CardDescription>
            </CardHeader>
            <CardContent>
              {data.combinationFrequencies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No wear events yet.</p>
              ) : (
                <ul className="space-y-2 font-mono text-xs">
                  {data.combinationFrequencies.slice(0, 20).map((row) => (
                    <li
                      key={row.combinationKey}
                      className="flex flex-wrap justify-between gap-2 border-b py-1"
                    >
                      <span className="truncate">{row.combinationKey}</span>
                      <span>
                        {row.count}× · {row.sourceSample}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Promotion candidates</CardTitle>
              <CardDescription>
                Non-outfit combos at or above the promote threshold
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.promotionCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No candidates yet (need ≥3 wears of the same multi-item combo).
                </p>
              ) : (
                <ul className="space-y-2 font-mono text-xs">
                  {data.promotionCandidates.map((row) => (
                    <li
                      key={row.combinationKey}
                      className="flex flex-wrap justify-between gap-2 border-b py-1"
                    >
                      <span className="truncate">{row.combinationKey}</span>
                      <span>
                        {row.count}× · {row.sourceSample}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
