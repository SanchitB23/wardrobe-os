/**
 * Human-readable Buy vs Skip analysis summary for Decision History cards.
 * Full JSON stays behind a Developer disclosure.
 */

"use client";

import type { BuyVsSkipAnalysis } from "@/domain/acquisition";
import { DecisionTraceDebug } from "@/features/acquisition/components/DecisionTraceDebug";
import { DecisionVerdictBadge } from "@/features/acquisition/components/DecisionVerdictBadge";
import { cn } from "@/lib/utils";

function ReasonList({
  items,
  tone,
}: {
  items: string[];
  tone: "buy" | "skip" | "muted";
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">None.</p>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {items.map((r, i) => (
        <li
          key={i}
          className={cn(
            tone === "buy" && "text-emerald-700 dark:text-emerald-400",
            tone === "skip" && "text-destructive",
            tone === "muted" && "text-muted-foreground",
          )}
        >
          {r}
        </li>
      ))}
    </ul>
  );
}

export function DecisionAnalysisSummary({
  analysis,
}: {
  analysis: BuyVsSkipAnalysis;
}) {
  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <DecisionVerdictBadge decision={analysis.decision} />
        <span className="text-sm tabular-nums text-muted-foreground">
          Score {analysis.score}
          {analysis.confidence != null
            ? ` · confidence ${Math.round(analysis.confidence * 100)}%`
            : ""}
        </span>
      </div>

      {analysis.summary ? (
        <p className="text-sm leading-relaxed">{analysis.summary}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reasons to buy
          </h4>
          <ReasonList items={analysis.reasonsToBuy ?? []} tone="buy" />
        </div>
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reasons to skip
          </h4>
          <ReasonList items={analysis.reasonsToSkip ?? []} tone="skip" />
        </div>
      </div>

      {(analysis.tradeoffs?.length ?? 0) > 0 ? (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tradeoffs
          </h4>
          <ReasonList items={analysis.tradeoffs} tone="muted" />
        </div>
      ) : null}

      <DecisionTraceDebug analysis={analysis} />

      <details className="rounded-md border bg-background/60 p-3 text-xs">
        <summary className="cursor-pointer font-medium text-muted-foreground">
          Developer disclosure · raw JSON
        </summary>
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">
          {JSON.stringify(analysis, null, 2)}
        </pre>
      </details>
    </div>
  );
}
