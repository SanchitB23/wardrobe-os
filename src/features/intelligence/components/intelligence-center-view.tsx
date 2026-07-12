"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BriefcaseIcon,
  BugIcon,
  CompassIcon,
  RefreshCwIcon,
  Repeat2Icon,
  ShirtIcon,
  ShoppingBagIcon,
  SparklesIcon,
  WandSparklesIcon,
  XCircleIcon,
} from "lucide-react";

import type { ActionCard, ActionPriority, ActionType } from "@/domain/intelligence";
import { useIntelligenceCenter } from "@/features/intelligence/hooks/useIntelligenceCenter";
import { useExploreExploit } from "@/features/personalization/hooks/useExploreExploit";
import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ACTION_ICON: Record<ActionType, typeof ShirtIcon> = {
  wear: ShirtIcon,
  buy: ShoppingBagIcon,
  skip: XCircleIcon,
  clean: SparklesIcon,
  rotate: RefreshCwIcon,
  pack: BriefcaseIcon,
  replace: Repeat2Icon,
  explore: CompassIcon,
};

const PRIORITY_TONE: Record<ActionPriority, string> = {
  critical: "border-destructive/40 text-destructive",
  high: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  medium: "border-blue-500/40 text-blue-600 dark:text-blue-400",
  low: "border-border text-muted-foreground",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** One action row. Reused by the full view and the Today "Do this next" section. */
export function ActionCardRow({ card, debug }: { card: ActionCard; debug?: boolean }) {
  const Icon = ACTION_ICON[card.type];
  const body = (
    <div className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {card.type === "replace" ? "optimize" : card.type}
          </span>
          <span className="font-medium">{card.subject.label}</span>
          <Badge variant="outline" className={cn("text-[10px] capitalize", PRIORITY_TONE[card.priority])}>
            {card.priority}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{card.reason}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums" title="Impact">impact {pct(card.impact)}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums" title="Confidence">confidence {pct(card.confidence)}</span>
          <span aria-hidden>·</span>
          <span>from {card.sources.join(", ")}</span>
        </div>
        {debug ? (
          <p className="font-mono text-[11px] text-muted-foreground">
            impact = provisional {card.debug.provisionalImpact.toFixed(2)} × reliability{" "}
            {card.debug.sourceReliability.toFixed(2)} × conf → {card.impact.toFixed(3)} ({card.priority})
            {card.debug.dedupedFrom > 1 ? ` · merged ${card.debug.dedupedFrom}` : ""} · codes:{" "}
            {card.reasonCodes.join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
  return card.href ? (
    <Link href={card.href} className="block" aria-label={`${card.type === "replace" ? "optimize" : card.type}: ${card.subject.label}`}>
      {body}
    </Link>
  ) : (
    body
  );
}

export function IntelligenceCenterView() {
  const { mode: exploreExploit } = useExploreExploit();
  const [debug, setDebug] = useState(false);
  const query = useIntelligenceCenter({ exploreExploit });
  const actions = query.data?.topActions ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Intelligence Center"
        badge={<Badge variant="secondary">Beta</Badge>}
        description="Do this next — every deterministic engine, aggregated into one prioritised list of actions. The engines decide; the Center ranks by impact; AI explains."
        actions={
          <Button variant={debug ? "default" : "outline"} onClick={() => setDebug((d) => !d)} aria-pressed={debug}>
            <BugIcon />
            Debug
          </Button>
        }
      />

      {query.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : null}

      {query.error ? (
        <InventoryErrorState message={query.error.message} onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
      ) : null}

      {query.data && actions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <WandSparklesIcon className="size-8 text-muted-foreground" />
          <p className="font-medium">Nothing urgent right now</p>
          <p className="text-sm text-muted-foreground">Your wardrobe looks healthy — no prioritised actions today.</p>
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div className="space-y-2">
          {actions.map((card) => (
            <ActionCardRow key={card.id} card={card} debug={debug} />
          ))}
        </div>
      ) : null}

      {debug && query.data ? (
        <Card className="border-dashed">
          <CardContent className="py-3 text-xs text-muted-foreground">
            <span className="font-mono">
              candidates {query.data.metadata.candidateCount} · deduped {query.data.metadata.dedupedCount} · by source:{" "}
              {Object.entries(query.data.metadata.bySource)
                .map(([s, n]) => `${s} ${n}`)
                .join(", ")}
            </span>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
