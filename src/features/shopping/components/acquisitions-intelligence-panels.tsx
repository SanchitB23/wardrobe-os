"use client";

import Link from "next/link";

import {
  LIFECYCLE_STATE_LABELS,
  LIFECYCLE_STATE_ORDER,
  type AcquisitionsIntelligence,
} from "@/domain/shopping/v2";
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

function pct(n: number | null | undefined): string {
  return n == null ? "—" : `${n}%`;
}

/** Opportunity Queue + Strategy (learned) — hub highlight panels. */
export function AcquisitionsIntelligenceSummary({
  intelligence,
}: {
  intelligence: AcquisitionsIntelligence;
}) {
  const top = intelligence.opportunityQueue.slice(0, 5);
  const rules = intelligence.strategy.rules.slice(0, 4);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Opportunity Queue</CardTitle>
          <CardDescription>
            Learned ranking (018 priority + need + lifecycle). Distinct from
            user wishlist priority and today&apos;s static queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {top.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active wishlist items to score. Add items or open Shopping
              Intelligence.
            </p>
          ) : (
            top.map((o) => (
              <div
                key={o.id}
                className="space-y-1 rounded-md border border-border/60 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{o.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {o.opportunityScore}
                  </span>
                </div>
                <Progress value={o.opportunityScore} className="h-1" />
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    018 priority {o.fromPriority}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {LIFECYCLE_STATE_LABELS[o.lifecycleState]}
                  </Badge>
                  {o.reasons.slice(0, 2).map((r) => (
                    <Badge key={r} variant="outline" className="text-[10px]">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
          <Button
            variant="link"
            className="h-auto px-0"
            render={<Link href="/acquisitions/wishlist" />}
          >
            Open wishlist
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Strategy (learned)</CardTitle>
          <CardDescription>
            Dynamic rules from outcomes — not the RFC-018 static top-N list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.code}
              className="rounded-md border border-border/60 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant={rule.severity === "warn" ? "destructive" : "secondary"}
                  className="text-[10px]"
                >
                  {rule.code}
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{rule.message}</p>
            </div>
          ))}
          <Button
            variant="link"
            className="h-auto px-0"
            render={<Link href="/acquisitions/intelligence" />}
          >
            Queue (today) — Shopping Intelligence
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function LifecycleIntelligencePanel({
  intelligence,
}: {
  intelligence: AcquisitionsIntelligence;
}) {
  const subjects = intelligence.lifecycle.subjects;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Purchase Lifecycle (018B)</CardTitle>
        <CardDescription>
          Formal states including established, low usage, and retired.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="flex flex-wrap gap-2 text-sm">
          {LIFECYCLE_STATE_ORDER.map((state, i) => (
            <li key={state} className="flex items-center gap-2">
              {i > 0 ? (
                <span className="text-muted-foreground">→</span>
              ) : null}
              <Badge variant="outline">{LIFECYCLE_STATE_LABELS[state]}</Badge>
            </li>
          ))}
        </ol>
        {subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subjects yet.</p>
        ) : (
          <ul className="space-y-2">
            {subjects.slice(0, 12).map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="truncate">{s.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {LIFECYCLE_STATE_LABELS[s.state]}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {s.wears} wears
                    {s.costPerWear != null ? ` · CPW ${s.costPerWear}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function AccuracyIntelligencePanel({
  intelligence,
}: {
  intelligence: AcquisitionsIntelligence;
}) {
  const { accuracy } = intelligence;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Recommendation Accuracy</CardTitle>
        <CardDescription>
          Shallow (bought/dismissed) and deep (bought → worn → ROI).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-2xl font-semibold tabular-nums">
              {pct(accuracy.accuracyPercent)}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Shallow{accuracy.sampleSize > 0 ? ` (n=${accuracy.sampleSize})` : ""}
            </div>
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums">
              {pct(accuracy.deepAccuracyPercent)}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Deep
              {accuracy.deepSampleSize > 0
                ? ` (n=${accuracy.deepSampleSize})`
                : ""}
            </div>
          </div>
        </div>
        {accuracy.cases.filter((c) => c.correct != null || c.deepCorrect != null)
          .length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No scored outcomes yet. Decisions need a purchased or dismissed
            wishlist match.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {accuracy.cases
              .filter((c) => c.correct != null || c.deepCorrect != null)
              .slice(0, 20)
              .map((c) => (
                <li
                  key={c.decisionId}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-1"
                >
                  <span className="truncate">{c.itemName}</span>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {c.decision}
                    </Badge>
                    {c.correct != null ? (
                      <Badge
                        variant={c.correct ? "default" : "destructive"}
                        className="text-[10px]"
                      >
                        shallow {c.correct ? "hit" : "miss"}
                      </Badge>
                    ) : null}
                    {c.deepCorrect != null ? (
                      <Badge
                        variant={c.deepCorrect ? "secondary" : "destructive"}
                        className="text-[10px]"
                      >
                        deep {c.deepCorrect ? "hit" : "miss"}
                      </Badge>
                    ) : null}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function NeedEvolutionPanel({
  intelligence,
}: {
  intelligence: AcquisitionsIntelligence;
}) {
  const points = intelligence.needTimeline.points.slice(-12);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Need Evolution</CardTitle>
        <CardDescription>
          Gap need scores over time (health gaps + purchase residuals).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No need timeline points — wardrobe health gaps or dated purchases
            will populate this.
          </p>
        ) : (
          <ul className="space-y-2">
            {points.map((p, i) => (
              <li
                key={`${p.date}-${p.category}-${i}`}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {p.category ?? "Uncategorized"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.date.slice(0, 10)}
                  </div>
                </div>
                <div className="w-24 shrink-0">
                  <Progress value={p.needScore} className="h-1" />
                  <div className="text-right text-xs tabular-nums text-muted-foreground">
                    {p.needScore}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RoiEvolutionPanel({
  intelligence,
}: {
  intelligence: AcquisitionsIntelligence;
}) {
  const { roiTimeline } = intelligence;
  const points = roiTimeline.points.slice(-8);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">ROI Evolution</CardTitle>
        <CardDescription>
          Utilization over purchase history plus best/worst category cohorts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ROI timeline yet.</p>
        ) : (
          <ul className="space-y-2">
            {points.map((p, i) => (
              <li
                key={`${p.date}-${i}`}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {p.date.slice(0, 10)}
                </span>
                <span className="tabular-nums">
                  ROI {p.wardrobeRoiScore}
                  {p.averageCostPerWear != null
                    ? ` · avg CPW ${p.averageCostPerWear}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs uppercase text-muted-foreground">
              Best cohorts
            </div>
            {roiTimeline.bestCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              roiTimeline.bestCategories.map((c) => (
                <div
                  key={c.category}
                  className="flex justify-between text-sm"
                >
                  <span>{c.category}</span>
                  <span className="tabular-nums">{c.score}</span>
                </div>
              ))
            )}
          </div>
          <div>
            <div className="mb-1 text-xs uppercase text-muted-foreground">
              Worst cohorts
            </div>
            {roiTimeline.worstCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              roiTimeline.worstCategories.map((c) => (
                <div
                  key={c.category}
                  className="flex justify-between text-sm"
                >
                  <span>{c.category}</span>
                  <span className="tabular-nums">{c.score}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
