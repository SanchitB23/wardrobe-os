/**
 * Decision lifecycle stepper — Analyzed → Wishlist → Purchased →
 * Inventory Created → First Wear → ROI.
 */

import type { DecisionLifecycleStatus } from "@/domain/shopping";
import {
  DECISION_LIFECYCLE_LABELS,
  DECISION_LIFECYCLE_ORDER,
} from "@/features/acquisition/lib/decision-lifecycle-labels";
import { cn } from "@/lib/utils";

export {
  DECISION_LIFECYCLE_LABELS,
  DECISION_LIFECYCLE_ORDER,
} from "@/features/acquisition/lib/decision-lifecycle-labels";

function reachedIndex(status: DecisionLifecycleStatus): number {
  return DECISION_LIFECYCLE_ORDER.indexOf(status);
}

export function DecisionLifecycleStepper({
  status,
  wears,
  costPerWear,
}: {
  status: DecisionLifecycleStatus;
  wears?: number;
  costPerWear?: number | null;
}) {
  const current = reachedIndex(status);
  return (
    <div className="space-y-1.5">
      <ol className="flex flex-wrap items-center gap-1.5">
        {DECISION_LIFECYCLE_ORDER.map((step, index) => {
          const done = index <= current;
          const active = index === current;
          return (
            <li key={step} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span className="text-muted-foreground/50" aria-hidden>
                  →
                </span>
              ) : null}
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  done
                    ? active
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground"
                    : "bg-muted/40 text-muted-foreground",
                )}
              >
                {DECISION_LIFECYCLE_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
      {status === "worn" || status === "roi" ? (
        <p className="text-xs text-muted-foreground">
          {wears ?? 0} wear{(wears ?? 0) === 1 ? "" : "s"}
          {costPerWear != null ? ` · ${costPerWear}/wear` : ""}
        </p>
      ) : null}
    </div>
  );
}
