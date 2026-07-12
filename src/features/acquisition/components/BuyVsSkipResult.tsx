"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleHelpIcon,
  LightbulbIcon,
  XCircleIcon,
} from "lucide-react";

import type { BuyDecision, BuyVsSkipAnalysis, BuyVsSkipInputSource, ProspectiveItem } from "@/features/acquisition/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BuyVsSkipPipelineActions } from "@/features/acquisition/components/BuyVsSkipPipelineActions";
import { DecisionTraceDebug } from "@/features/acquisition/components/DecisionTraceDebug";
import { PotentialOutfits } from "@/features/acquisition/components/PotentialOutfits";
import { ScoreBreakdown } from "@/features/acquisition/components/ScoreBreakdown";
import { SimilarItems } from "@/features/acquisition/components/SimilarItems";
import type { ImageCandidate } from "@/features/shopping/services/acquisitionPipeline.service";

const DECISION_STYLE: Record<
  BuyDecision,
  { label: string; className: string; icon: typeof CheckCircle2Icon }
> = {
  buy: {
    label: "Buy",
    className: "bg-emerald-600 text-white dark:bg-emerald-500",
    icon: CheckCircle2Icon,
  },
  consider: {
    label: "Consider",
    className: "bg-amber-500 text-white dark:bg-amber-500",
    icon: CircleHelpIcon,
  },
  skip: {
    label: "Skip",
    className: "bg-destructive text-white",
    icon: XCircleIcon,
  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground/70">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ReasonList({ items, tone }: { items: string[]; tone: "buy" | "skip" | "muted" }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">None.</p>;
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

export function BuyVsSkipResult({
  analysis,
  item,
  source = "manual",
  decisionId,
  imageCandidate,
}: {
  analysis: BuyVsSkipAnalysis;
  item?: ProspectiveItem;
  source?: BuyVsSkipInputSource;
  decisionId?: string | null;
  imageCandidate?: ImageCandidate | null;
}) {
  const decision = DECISION_STYLE[analysis.decision];
  const DecisionIcon = decision.icon;
  const confidencePct = Math.round(analysis.confidence * 100);
  const lowConfidence = analysis.explainabilityCodes.includes("LOW_CONFIDENCE");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold", decision.className)}>
            <DecisionIcon className="size-4" />
            {decision.label}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-semibold tabular-nums">{analysis.score}</div>
              <div className="text-xs text-muted-foreground">/ 100 score</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tabular-nums">{confidencePct}%</div>
              <div className="text-xs text-muted-foreground">confidence</div>
            </div>
          </div>
        </div>
        <CardTitle className="pt-2 text-base font-normal text-muted-foreground">
          {analysis.summary}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {item ? (
          <BuyVsSkipPipelineActions
            analysis={analysis}
            item={item}
            source={source}
            decisionId={decisionId}
            imageCandidate={imageCandidate}
          />
        ) : null}

        {lowConfidence ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              Low confidence — this verdict is based on sparse input. Add price, material, style
              tags, and occasions for a stronger recommendation.
            </span>
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Section title="Reasons to buy">
            <ReasonList items={analysis.reasonsToBuy} tone="buy" />
          </Section>
          <Section title="Reasons to skip">
            <ReasonList items={analysis.reasonsToSkip} tone="skip" />
          </Section>
        </div>

        {analysis.tradeoffs.length > 0 ? (
          <Section title="Trade-offs">
            <ReasonList items={analysis.tradeoffs} tone="muted" />
          </Section>
        ) : null}

        {analysis.suggestedAlternatives.length > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <LightbulbIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <ul className="space-y-1">
              {analysis.suggestedAlternatives.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Estimated cost per wear</div>
            <div className="text-lg font-semibold tabular-nums">
              {analysis.estimatedCostPerWear != null ? `≈ ${analysis.estimatedCostPerWear}` : "—"}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Wardrobe impact</div>
            <div className="text-lg font-semibold tabular-nums">
              {analysis.wardrobeImpactScore}
              <span className="text-sm font-normal text-muted-foreground"> / 100</span>
            </div>
          </div>
        </div>

        <Section title="Score breakdown">
          <ScoreBreakdown breakdown={analysis.scoreBreakdown} />
        </Section>

        <div className="grid gap-5 sm:grid-cols-2">
          <Section title="Similar existing items">
            <SimilarItems items={analysis.similarExistingItems} />
          </Section>
          <Section title="Potential outfits">
            <PotentialOutfits outfits={analysis.potentialOutfits} />
          </Section>
        </div>

        <DecisionTraceDebug analysis={analysis} />
      </CardContent>
    </Card>
  );
}
