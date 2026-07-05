"use client";

import {
  CheckIcon,
  GaugeIcon,
  TriangleAlertIcon,
  WandSparklesIcon,
} from "lucide-react";

import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useOutfitEvaluation } from "@/features/outfits/hooks";
import type { OutfitDetail } from "@/features/outfits/types";
import type { OutfitAnalysisBreakdown, RuleResult } from "@/domain/outfit";

type BreakdownKey = keyof OutfitAnalysisBreakdown;

const ENGINE_LABELS: Record<BreakdownKey, string> = {
  color: "Color Harmony",
  formality: "Formality",
  season: "Season",
  occasion: "Occasion",
  texture: "Texture",
  weather: "Weather",
  footwear: "Footwear",
};

const ENGINE_ORDER: BreakdownKey[] = [
  "color",
  "formality",
  "season",
  "occasion",
  "texture",
  "weather",
  "footwear",
];

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}% confidence`;
}

function scoreTone(score: number): string {
  if (score >= 8) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (score >= 6) {
    return "text-amber-600 dark:text-amber-400";
  }
  return "text-destructive";
}

function ScoreBar({
  label,
  score,
  showText = false,
}: {
  label: string;
  score: number;
  showText?: boolean;
}) {
  return (
    <Progress
      value={score}
      max={10}
      aria-label={`${label} score`}
      getAriaValueText={(_, value) => `${value ?? 0} of 10`}
    >
      {showText ? (
        <>
          <ProgressLabel>{label}</ProgressLabel>
          <ProgressValue>{() => `${score}/10`}</ProgressValue>
        </>
      ) : null}
    </Progress>
  );
}

function EngineCard({ label, rule }: { label: string; rule: RuleResult }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{label}</CardTitle>
          <span className={`text-lg font-semibold tabular-nums ${scoreTone(rule.score)}`}>
            {rule.score}/10
          </span>
        </div>
        <CardDescription>{formatConfidence(rule.confidence)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScoreBar label={label} score={rule.score} />
        <p className="text-sm text-muted-foreground">{rule.reason}</p>
        {rule.weaknesses.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {rule.weaknesses.map((weakness, index) => (
              <li key={`${index}-${weakness}`} className="flex gap-2">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{weakness}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {rule.suggestions.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {rule.suggestions.map((suggestion, index) => (
              <li key={`${index}-${suggestion}`} className="flex gap-2">
                <WandSparklesIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ScorePanelSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

type OutfitScorePanelProps = {
  outfit: OutfitDetail;
};

export function OutfitScorePanel({ outfit }: OutfitScorePanelProps) {
  const evaluationQuery = useOutfitEvaluation(outfit);

  if (evaluationQuery.isPending) {
    return <ScorePanelSkeleton />;
  }

  if (evaluationQuery.error) {
    return (
      <InventoryErrorState
        message={evaluationQuery.error.message}
        onRetry={() => void evaluationQuery.refetch()}
        isRetrying={evaluationQuery.isFetching}
      />
    );
  }

  const analysis = evaluationQuery.data;
  if (!analysis) {
    return null;
  }

  return (
    <section className="space-y-4" aria-label="Outfit score">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GaugeIcon className="size-5 text-muted-foreground" />
              <CardTitle>Outfit score</CardTitle>
            </div>
            <span
              className={`text-3xl font-semibold tabular-nums ${scoreTone(analysis.overallScore)}`}
            >
              {analysis.overallScore}/10
            </span>
          </div>
          <CardDescription>
            Rule-based breakdown from the outfit engine — no AI involved.{" "}
            {formatConfidence(analysis.confidence)} · engine v
            {analysis.metadata.engineVersion}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScoreBar label="Overall" score={analysis.overallScore} showText />

          <p className="text-sm">{analysis.summary}</p>

          {analysis.strengths.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Strengths</p>
              <ul className="space-y-1 text-sm">
                {analysis.strengths.map((strength, index) => (
                  <li key={`${index}-${strength}`} className="flex gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.weaknesses.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Weaknesses</p>
              <ul className="space-y-1 text-sm">
                {analysis.weaknesses.map((weakness, index) => (
                  <li key={`${index}-${weakness}`} className="flex gap-2">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ENGINE_ORDER.map((key) => {
          const rule = analysis.breakdown[key];
          if (!rule) {
            return null;
          }
          return <EngineCard key={key} label={ENGINE_LABELS[key]} rule={rule} />;
        })}
      </div>

      {analysis.suggestions.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <WandSparklesIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Improve outfit</CardTitle>
              <Badge variant="outline">Rule-based</Badge>
            </div>
            <CardDescription>
              Recommendations from the outfit engine, weakest dimensions first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {analysis.suggestions.map((suggestion, index) => (
                <li key={`${index}-${suggestion}`} className="flex gap-2">
                  <WandSparklesIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
