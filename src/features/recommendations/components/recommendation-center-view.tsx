"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BugIcon,
  CheckCircleIcon,
  DatabaseIcon,
  EyeIcon,
  LightbulbIcon,
  Loader2Icon,
  RefreshCwIcon,
  SaveIcon,
  ShirtIcon,
  SparklesIcon,
  WandSparklesIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";

import { InventoryErrorState } from "@/features/inventory/components/inventory-error-state";
import { useExploreExploit } from "@/features/personalization/hooks/useExploreExploit";
import { PageHeader } from "@/features/layout";
import {
  useOutfitRecommendations,
  useRecommendationExplanation,
  useSaveGeneratedOutfit,
  useWearOutfit,
  type ItemPreview,
  type RecommendationContextSummary,
  type RecommendationFilters,
} from "@/features/recommendations/hooks";
import type { ExplainSharedContext } from "@/features/recommendations/ai/explanation.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ColorSwatch } from "@/shared/ui";
import { cn } from "@/lib/utils";
import type {
  CommuteMode,
  RecommendationQuality,
  RecommendationV2,
  RecommendedOutfitItem,
  SeasonLabel,
  WeatherCondition,
} from "@/domain/recommendation";

type FilterGroup = {
  key: keyof RecommendationFilters;
  label: string;
  options: readonly string[];
};

const OCCASIONS = ["Office", "Casual", "Dinner", "Travel", "Gym", "Wedding"] as const;
const SEASONS: readonly SeasonLabel[] = ["summer", "monsoon", "autumn", "winter", "spring"];
const WEATHER: readonly WeatherCondition[] = ["hot", "warm", "mild", "cool", "cold", "rainy"];
const COMMUTES: readonly CommuteMode[] = ["wfh", "metro", "car", "walk", "mixed"];

type CardHandlers = {
  previews: Record<string, ItemPreview>;
  debug: boolean;
  onSave: (rec: RecommendationV2) => void;
  onWear: (rec: RecommendationV2) => void;
  saving: boolean;
  wearing: boolean;
  /** Shared context used to build the AI explanation input (per response). */
  explainContext?: ExplainSharedContext;
};

function scoreTone(score: number): string {
  if (score >= 8) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 6.5) return "text-blue-600 dark:text-blue-400";
  if (score >= 5) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium capitalize transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function ItemChip({
  item,
  preview,
  large,
}: {
  item: RecommendedOutfitItem;
  preview?: ItemPreview;
  large?: boolean;
}) {
  const size = large ? "size-7" : "size-6";
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border bg-muted/30 py-1 pl-1 pr-2.5"
      title={`${item.name}${preview?.color ? ` · ${preview.color}` : ""}`}
    >
      {preview?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.imageUrl} alt="" className={cn(size, "rounded-full object-cover")} />
      ) : (
        <ColorSwatch colorName={preview?.color ?? item.name} family={null} size={large ? "lg" : "md"} />
      )}
      <span className="max-w-32 truncate text-xs">{item.name}</span>
    </div>
  );
}

function OutfitPreview({
  rec,
  previews,
  large,
}: {
  rec: RecommendationV2;
  previews: Record<string, ItemPreview>;
  large?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {rec.items.map((item) => (
        <ItemChip key={item.itemId} item={item} preview={previews[item.itemId]} large={large} />
      ))}
    </div>
  );
}

function SourceBadge({ source }: { source: RecommendationV2["source"] }) {
  return source === "saved_outfit" ? (
    <Badge variant="secondary">Saved outfit</Badge>
  ) : (
    <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400">
      Generated
    </Badge>
  );
}

function ScoreConfidence({ rec }: { rec: RecommendationV2 }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <span className={cn("text-2xl font-semibold tabular-nums", scoreTone(rec.score))}>
          {rec.score.toFixed(1)}
        </span>
        <span className="text-sm text-muted-foreground">/10</span>
      </div>
      <Badge variant="secondary" className="tabular-nums">
        {Math.round(rec.confidence * 100)}% confidence
      </Badge>
    </div>
  );
}

function MetaList({
  title,
  icon: Icon,
  items,
  tone,
}: {
  title: string;
  icon: typeof CheckCircleIcon;
  items: string[];
  tone: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className={cn("size-3.5", tone)} />
        {title}
      </p>
      <ul className="space-y-0.5 text-sm">
        {items.map((entry, index) => (
          <li key={index} className="text-muted-foreground">
            {entry}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DebugBlock({ rec }: { rec: RecommendationV2 }) {
  const d = rec.debug;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs">
      <p className="mb-1.5 flex items-center gap-1.5 font-medium text-muted-foreground">
        <BugIcon className="size-3.5" />
        Debug
      </p>
      <ul className="space-y-0.5 break-words font-mono">
        <li>source: {rec.source}</li>
        <li>sourceRank: {d.sourceRank}</li>
        {d.savedOutfitScore !== undefined ? <li>savedOutfitScore: {d.savedOutfitScore.toFixed(1)}</li> : null}
        {d.generatedScore !== undefined ? <li>generatedScore: {d.generatedScore.toFixed(1)}</li> : null}
        {d.boosts && d.boosts.length > 0 ? (
          <li className="text-emerald-600 dark:text-emerald-400">boosts: {d.boosts.join(", ")}</li>
        ) : null}
        {d.penalties && d.penalties.length > 0 ? (
          <li className="text-destructive">penalties: {d.penalties.join(", ")}</li>
        ) : null}
        {rec.reasonCodes.length > 0 ? <li>reasonCodes: {rec.reasonCodes.join(", ")}</li> : null}
        <li>
          diversity: rank {rec.diversity.rank}
          {rec.diversity.heldBackNearDuplicates > 0
            ? ` · held back ${rec.diversity.heldBackNearDuplicates} near-dup`
            : ""}
          {rec.diversity.relaxed ? " · relaxed" : ""}
        </li>
        <li className="pt-1 text-muted-foreground">
          top dims:{" "}
          {[...rec.breakdown.dimensions]
            .sort((a, b) => b.weighted - a.weighted)
            .slice(0, 3)
            .map((dim) => `${dim.dimension} ${dim.raw.toFixed(1)}`)
            .join(", ")}
        </li>
      </ul>
    </div>
  );
}

/** RFC-012 per-run recommendation quality metrics (Developer Mode). */
function QualityPanel({ quality }: { quality: RecommendationQuality }) {
  const rows: [string, string][] = [
    ["Eligible", String(quality.eligibleCandidateCount)],
    ["Rejected", String(quality.rejectedCandidateCount)],
    ["Diversity", `${Math.round(quality.diversityScore * 100)}%`],
    ["Avg confidence", `${Math.round(quality.averageConfidence * 100)}%`],
    ["Source mix", `${quality.sourceMix.saved} saved · ${quality.sourceMix.generated} generated`],
    ["Weather influence", `${Math.round(quality.weatherInfluence * 100)}%`],
    ["Personalization influence", `${Math.round(quality.personalizationInfluence * 100)}%`],
  ];
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BugIcon className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Recommendation quality (RFC-012)</CardTitle>
        </div>
        <CardDescription>Per-run metrics from Recommendation Engine v2.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {rows.map(([label, value]) => (
          <Badge key={label} variant="secondary" className="tabular-nums">
            {label}: {value}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function ActionButtons({
  rec,
  onSave,
  onWear,
  saving,
  wearing,
}: {
  rec: RecommendationV2;
  onSave: (rec: RecommendationV2) => void;
  onWear: (rec: RecommendationV2) => void;
  saving: boolean;
  wearing: boolean;
}) {
  if (rec.source === "saved_outfit") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onWear(rec)} disabled={wearing}>
          <ShirtIcon />
          Wear outfit
        </Button>
        {rec.savedOutfitId ? (
          <Button size="sm" variant="outline" render={<Link href={`/outfits/${rec.savedOutfitId}`} />}>
            <EyeIcon />
            View outfit
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => onSave(rec)} disabled={saving}>
        <SaveIcon />
        Save as outfit
      </Button>
      <Button size="sm" variant="outline" onClick={() => onWear(rec)} disabled={wearing}>
        <ShirtIcon />
        Wear today
      </Button>
    </div>
  );
}

function ExplanationList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="list-disc space-y-0.5 pl-4">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Lazily-loaded AI explanation for a single recommendation. The query fires
 * only when `open` is true (the user clicked ✨ Explain) and is cached by the
 * recommendation's deterministic key. Fails gracefully with a retry.
 */
function ExplainSection({
  rec,
  shared,
  open,
}: {
  rec: RecommendationV2;
  shared: ExplainSharedContext | undefined;
  open: boolean;
}) {
  const query = useRecommendationExplanation(rec, shared, open);
  if (!open) return null;

  const panel = "rounded-lg border bg-muted/30 p-3 text-sm";

  if (!shared) {
    return (
      <div className={cn(panel, "text-muted-foreground")}>
        Explanation isn&apos;t available for this recommendation right now.
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className={cn(panel, "flex items-center gap-2 text-muted-foreground")}>
        <Loader2Icon className="size-4 animate-spin" />
        Writing an explanation…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className={cn(panel, "space-y-2")}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <XCircleIcon className="size-4" />
          Couldn&apos;t generate an explanation right now.
        </div>
        <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
          <RefreshCwIcon />
          Try again
        </Button>
      </div>
    );
  }

  const { explanation: data, cached } = query.data;
  return (
    <div className={cn(panel, "space-y-3")}>
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary" className="gap-1">
          {cached ? (
            <>
              <DatabaseIcon className="size-3" />
              Cached
            </>
          ) : (
            <>
              <SparklesIcon className="size-3" />
              Fresh
            </>
          )}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          className="h-7"
          onClick={() => void query.regenerate()}
          disabled={query.isFetching}
        >
          <RefreshCwIcon className={query.isFetching ? "animate-spin" : undefined} />
          Regenerate
        </Button>
      </div>
      <p className="font-medium">{data.summary}</p>
      {data.whyThisWorks ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Why this works
          </p>
          <p className="text-muted-foreground">{data.whyThisWorks}</p>
        </div>
      ) : null}
      <ExplanationList title="Styling tips" items={data.stylingTips} />
      {data.confidenceExplanation ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            About the score
          </p>
          <p className="text-muted-foreground">{data.confidenceExplanation}</p>
        </div>
      ) : null}
      <ExplanationList title="Things to avoid" items={data.thingsToAvoid} />
    </div>
  );
}

function RecommendationCard({
  rec,
  handlers,
  hero,
}: {
  rec: RecommendationV2;
  handlers: CardHandlers;
  hero?: boolean;
}) {
  const { previews, debug, onSave, onWear, saving, wearing, explainContext } = handlers;
  const [explaining, setExplaining] = useState(false);
  return (
    <Card
      className={cn(
        "flex h-full flex-col",
        hero && "border-foreground/15 bg-gradient-to-br from-muted/40 to-background",
      )}
    >
      <CardHeader className={hero ? undefined : "pb-3"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {hero ? <WandSparklesIcon className="size-5 text-blue-600 dark:text-blue-400" /> : null}
            {hero ? <Badge variant="secondary">Top pick</Badge> : null}
            <SourceBadge source={rec.source} />
          </div>
          <ScoreConfidence rec={rec} />
        </div>
        <CardTitle className={hero ? "text-xl" : "text-base"}>{rec.name}</CardTitle>
        <CardDescription>{rec.reason}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <OutfitPreview rec={rec} previews={previews} large={hero} />
        <div className={cn("gap-4", hero ? "grid sm:grid-cols-3" : "space-y-3")}>
          <MetaList title="Strengths" icon={CheckCircleIcon} items={rec.strengths.slice(0, hero ? 99 : 3)} tone="text-emerald-600 dark:text-emerald-400" />
          <MetaList title="Tradeoffs" icon={AlertTriangleIcon} items={rec.tradeoffs.slice(0, hero ? 99 : 2)} tone="text-amber-600 dark:text-amber-400" />
          <MetaList title="Suggestions" icon={LightbulbIcon} items={rec.suggestions.slice(0, hero ? 99 : 2)} tone="text-blue-600 dark:text-blue-400" />
        </div>
        {debug ? <DebugBlock rec={rec} /> : null}
        <div className="mt-auto space-y-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <ActionButtons rec={rec} onSave={onSave} onWear={onWear} saving={saving} wearing={wearing} />
            <Button
              size="sm"
              variant="ghost"
              className="text-blue-600 dark:text-blue-400"
              onClick={() => setExplaining((value) => !value)}
              aria-expanded={explaining}
            >
              <SparklesIcon />
              {explaining ? "Hide" : "Explain"}
            </Button>
          </div>
          <ExplainSection rec={rec} shared={explainContext} open={explaining} />
        </div>
      </CardContent>
    </Card>
  );
}

function CardGrid({
  recs,
  handlers,
}: {
  recs: RecommendationV2[];
  handlers: CardHandlers;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {recs.map((rec) => (
        <RecommendationCard key={rec.id} rec={rec} handlers={handlers} />
      ))}
    </div>
  );
}

function ContextPanel({ context }: { context: RecommendationContextSummary }) {
  const rows: [string, string][] = [
    ["Occasion", context.occasion ?? "Any"],
    ["Season", context.season],
    ["Weather", context.weather],
    ["Commute", context.commute],
    ["Favorites only", context.favoritesOnly ? "Yes" : "No"],
  ];
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BugIcon className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Selected context</CardTitle>
        </div>
        <CardDescription>What the engine scored recommendations against.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {rows.map(([label, value]) => (
          <Badge key={label} variant="secondary" className="capitalize">
            {label}: {value}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function RecommendationsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function RecommendationCenterView() {
  const [filters, setFilters] = useState<RecommendationFilters>({});
  const [showDebug, setShowDebug] = useState(false);
  // RFC-013: the owner's explore/exploit setting (set on the Taste Profile) feeds
  // the ranking. Included in the query key so a change re-fetches.
  const { mode: exploreExploit } = useExploreExploit();
  const query = useOutfitRecommendations({ ...filters, exploreExploit });
  const saveMutation = useSaveGeneratedOutfit();
  const wearMutation = useWearOutfit();
  const data = query.data;

  function setSingle<K extends "occasion" | "season" | "weather" | "commute">(
    key: K,
    value: NonNullable<RecommendationFilters[K]>,
  ) {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
  }

  const hasActiveFilters = Boolean(
    filters.occasion ||
      filters.season ||
      filters.weather ||
      filters.commute ||
      filters.favoritesOnly,
  );
  function resetFilters() {
    setFilters({});
  }

  function handleSave(rec: RecommendationV2) {
    saveMutation.mutate({ items: rec.items });
  }
  function handleWear(rec: RecommendationV2) {
    wearMutation.mutate({
      itemIds: rec.items.map((item) => item.itemId),
      outfitId: rec.savedOutfitId,
    });
  }

  const groups: FilterGroup[] = [
    { key: "occasion", label: "Occasion", options: OCCASIONS },
    { key: "season", label: "Season", options: SEASONS },
    { key: "weather", label: "Weather", options: WEATHER },
    { key: "commute", label: "Commute", options: COMMUTES },
  ];

  const recommendations = data?.recommendations ?? [];
  const previews = data?.previews ?? {};
  const hero = recommendations[0];
  const saved = recommendations.filter((r) => r.source === "saved_outfit");
  const generated = recommendations.filter((r) => r.source === "generated_combo");
  const rejectionReasons =
    recommendations.find((r) => (r.debug?.rejectionReasons?.length ?? 0) > 0)?.debug
      ?.rejectionReasons ?? [];
  const isEmpty = data && recommendations.length === 0;

  const handlers: CardHandlers = {
    previews,
    debug: showDebug,
    onSave: handleSave,
    onWear: handleWear,
    saving: saveMutation.isPending,
    wearing: wearMutation.isPending,
    explainContext: data?.explainContext,
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Recommendations"
        badge={
          data ? (
            <Badge variant="secondary" className="tabular-nums">
              {recommendations.length} outfits
            </Badge>
          ) : null
        }
        description="Unified outfit recommendations — your saved outfits and freshly generated combinations, ranked together."
        breadcrumb={
          <Button variant="ghost" size="sm" className="-ml-2" render={<Link href="/dashboard" />}>
            <ArrowLeftIcon />
            Dashboard
          </Button>
        }
        actions={
          <>
            <Button
              variant={showDebug ? "default" : "outline"}
              onClick={() => setShowDebug((value) => !value)}
              aria-pressed={showDebug}
            >
              <BugIcon />
              Debug
            </Button>
            <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCwIcon className={query.isFetching ? "animate-spin" : undefined} />
              Refresh
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3">
        {groups.map((group) => (
          <div key={group.key as string} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 w-20 shrink-0 text-xs font-medium text-muted-foreground">
              {group.label}
            </span>
            {group.options.map((option) => (
              <FilterChip
                key={option}
                active={filters[group.key] === option}
                onClick={() =>
                  setSingle(group.key as "occasion" | "season" | "weather" | "commute", option)
                }
              >
                {option}
              </FilterChip>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-20 shrink-0 text-xs font-medium text-muted-foreground">
            Favorites
          </span>
          <FilterChip
            active={Boolean(filters.favoritesOnly)}
            onClick={() => setFilters((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))}
          >
            Favorites only
          </FilterChip>
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7"
              onClick={resetFilters}
            >
              <XIcon />
              Reset filters
            </Button>
          ) : null}
        </div>
      </div>

      {showDebug && data ? <ContextPanel context={data.context} /> : null}

      {showDebug && data ? <QualityPanel quality={data.quality} /> : null}

      {showDebug && rejectionReasons.length > 0 ? (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon className="size-4 text-destructive" />
              <CardTitle className="text-base">Rejected outfits</CardTitle>
              <Badge variant="secondary" className="tabular-nums">
                {rejectionReasons.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              {rejectionReasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {query.isPending ? <RecommendationsSkeleton /> : null}

      {query.error ? (
        <InventoryErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : null}

      {isEmpty && hasActiveFilters ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <WandSparklesIcon className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No outfits match these filters</p>
            <p className="text-sm text-muted-foreground">
              Your filters may be too strict for the current wardrobe. Try loosening the
              occasion, season, weather, or commute — or reset them.
            </p>
          </div>
          <Button variant="outline" onClick={resetFilters}>
            <XIcon />
            Reset filters
          </Button>
        </div>
      ) : null}

      {isEmpty && !hasActiveFilters ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <WandSparklesIcon className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No recommendations yet</p>
            <p className="text-sm text-muted-foreground">
              Save outfits or add tops, bottoms, and footwear to your wardrobe to get
              recommendations.
            </p>
          </div>
          <Button render={<Link href="/outfits/new" />}>Create an outfit</Button>
        </div>
      ) : null}

      {hero ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Hero recommendation</h2>
          <RecommendationCard rec={hero} handlers={handlers} hero />
        </section>
      ) : null}

      {saved.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Saved outfit recommendations</h2>
          <CardGrid recs={saved} handlers={handlers} />
        </section>
      ) : null}

      {generated.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Generated outfit recommendations</h2>
          <CardGrid recs={generated} handlers={handlers} />
        </section>
      ) : null}

      {recommendations.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">All recommendations</h2>
          <CardGrid recs={recommendations} handlers={handlers} />
        </section>
      ) : null}
    </div>
  );
}
