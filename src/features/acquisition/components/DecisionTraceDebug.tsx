"use client";

import { BugIcon } from "lucide-react";

import type { BuyVsSkipAnalysis } from "@/features/acquisition/types";
import { Badge } from "@/components/ui/badge";

/**
 * Developer-facing view of the deterministic decision: the ordered trace and
 * the machine-readable explainability codes. Rendered inside a collapsible
 * <details> so it stays out of the way by default.
 */
export function DecisionTraceDebug({ analysis }: { analysis: BuyVsSkipAnalysis }) {
  return (
    <details className="rounded-lg border bg-muted/20 p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <BugIcon className="size-4 text-muted-foreground" />
        Decision trace &amp; explainability codes
      </summary>

      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {analysis.explainabilityCodes.map((code) => (
            <Badge key={code} variant="outline" className="font-mono text-[10px]">
              {code}
            </Badge>
          ))}
        </div>

        <ol className="space-y-1 border-l pl-3 text-xs text-muted-foreground">
          {analysis.decisionTrace.map((entry, i) => (
            <li key={i}>
              <span className="font-mono text-foreground/80">{entry.step}</span>
              {typeof entry.value === "number" ? (
                <span className="tabular-nums"> = {entry.value}</span>
              ) : null}
              {" — "}
              {entry.detail}
            </li>
          ))}
        </ol>

        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">Engines:</span>{" "}
          buyVsSkip {analysis.metadata.contributingEngines.buyVsSkip} · styleDNA{" "}
          {analysis.metadata.contributingEngines.styleDNA} · outfit{" "}
          {analysis.metadata.contributingEngines.outfit}
          {analysis.metadata.contributingEngines.wardrobeHealth
            ? ` · health ${analysis.metadata.contributingEngines.wardrobeHealth}`
            : ""}
          {analysis.metadata.contributingEngines.usageAnalytics
            ? ` · usage ${analysis.metadata.contributingEngines.usageAnalytics}`
            : ""}
        </div>
      </div>
    </details>
  );
}
