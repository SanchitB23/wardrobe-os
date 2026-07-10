"use client";

import { useState } from "react";
import {
  AlertTriangleIcon,
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  Loader2Icon,
  PinIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";

import type { DerivedPreference, PreferenceDimension, PreferenceLifecycle } from "@/domain/personalization";
import type { PreferenceTimeline } from "@/domain/personalization/v2";
import { EXPLORE_EXPLOIT_MODES, type ExploreExploitMode } from "@/domain/personalization/v2";
import {
  useClearPreferenceOverride,
  usePreferenceProfile,
  useSavePreferenceOverride,
  useSetItemFlags,
} from "@/features/personalization/hooks/usePreferenceProfile";
import { useExploreExploit } from "@/features/personalization/hooks/useExploreExploit";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const pct = (n: number) => `${Math.round(n * 100)}%`;

type Section = { title: string; dimension: PreferenceDimension; items: DerivedPreference[] };

const LIFECYCLE_STYLE: Record<PreferenceLifecycle, string> = {
  core: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  emerging: "border-blue-500/40 text-blue-600 dark:text-blue-400",
  declining: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  avoided: "border-destructive/40 text-destructive",
};

/** RFC-013: colour-coded lifecycle badge (core / emerging / declining / avoided). */
function LifecycleBadge({ lifecycle }: { lifecycle: PreferenceLifecycle }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize", LIFECYCLE_STYLE[lifecycle])}>
      {lifecycle}
    </Badge>
  );
}

const TREND_ICON = {
  rising: ArrowUpRightIcon,
  steady: ArrowRightIcon,
  falling: ArrowDownRightIcon,
} as const;

/** RFC-013: a compact sparkline of a preference's weight across time windows. */
function TimelineRow({ timeline }: { timeline: PreferenceTimeline }) {
  const TrendIcon = TREND_ICON[timeline.trend];
  return (
    <div className="flex items-center gap-3 rounded-lg border p-2.5">
      <div className="min-w-24 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium capitalize">{timeline.value}</span>
          <Badge variant="secondary" className="text-[10px] capitalize">{timeline.dimension}</Badge>
        </div>
      </div>
      <div className="flex h-8 items-end gap-0.5" aria-hidden>
        {timeline.points.map((p, i) => (
          <div
            key={i}
            className="w-1.5 rounded-sm bg-primary/60"
            style={{ height: `${Math.max(4, Math.round(p.weight * 100))}%` }}
          />
        ))}
      </div>
      <span
        className={cn(
          "flex items-center gap-1 text-xs",
          timeline.trend === "rising" && "text-emerald-600 dark:text-emerald-400",
          timeline.trend === "falling" && "text-amber-600 dark:text-amber-400",
          timeline.trend === "steady" && "text-muted-foreground",
        )}
        title={`Trend: ${timeline.trend}`}
      >
        <TrendIcon className="size-3.5" /> {timeline.trend}
      </span>
    </div>
  );
}

const EXPLORE_EXPLOIT_LABEL: Record<ExploreExploitMode, { label: string; hint: string }> = {
  exploit: { label: "Exploit", hint: "Lean into proven favourites" },
  balanced: { label: "Balanced", hint: "Default mix" },
  explore: { label: "Explore", hint: "Surface underused, compatible items" },
};

/** RFC-013: explore/exploit selector — persisted; feeds Recommendation Engine v2. */
function ExploreExploitSelector() {
  const { mode, setMode } = useExploreExploit();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Explore vs Exploit</CardTitle>
        <CardDescription>{EXPLORE_EXPLOIT_LABEL[mode].hint}. Applies to your recommendations.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {EXPLORE_EXPLOIT_MODES.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={mode === value ? "default" : "outline"}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {EXPLORE_EXPLOIT_LABEL[value].label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function PreferenceRow({
  pref,
  onPin,
  onSuppress,
  onRemoveOverride,
  busy,
}: {
  pref: DerivedPreference;
  onPin: () => void;
  onSuppress: () => void;
  onRemoveOverride: () => void;
  busy: boolean;
}) {
  const isOverride = pref.source === "override";
  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium capitalize">{pref.value}</span>
          {pref.source === "prior" ? (
            <Badge variant="outline" className="text-[10px]">prior</Badge>
          ) : null}
          {isOverride ? (
            <Badge variant="secondary" className="text-[10px]">
              <PinIcon className="mr-1 size-2.5" /> pinned
            </Badge>
          ) : null}
          {pref.lifecycle ? <LifecycleBadge lifecycle={pref.lifecycle} /> : null}
        </div>
        <div className="flex items-center gap-1">
          {isOverride ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onRemoveOverride}>
              Remove
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" disabled={busy} onClick={onPin} title="Pin this preference">
                <PinIcon className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={onSuppress} title="Suppress this preference">
                <XIcon className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      <Progress value={Math.round(pref.weight * 100)} aria-label={`${pref.value} preference weight`} className="h-1.5" />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span title="How sure we are now">confidence {pct(pref.confidence)}</span>
        <span aria-hidden>·</span>
        <span title="How consistently this has held over time">stability {pct(pref.stability)}</span>
        {pref.since ? (
          <>
            <span aria-hidden>·</span>
            <span title="Since this preference became dominant">since {pref.since}</span>
          </>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{pref.reason}</p>
    </div>
  );
}

export function PreferencesView() {
  const query = usePreferenceProfile();
  const saveOverride = useSavePreferenceOverride();
  const clearOverride = useClearPreferenceOverride();
  const setFlags = useSetItemFlags();
  const [debug, setDebug] = useState(false);

  const busy = saveOverride.isPending || clearOverride.isPending || setFlags.isPending;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Preferences"
        badge={<Badge variant="secondary">Intelligence</Badge>}
        description="What Wardrobe OS has learned about your taste from how you actually wear, keep, and buy — derived deterministically from your behaviour. The engine learns; AI only explains. Pin, suppress, or override anything."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDebug((d) => !d)}>
              Debug {debug ? "on" : "off"}
            </Button>
            <Button variant="outline" size="sm" disabled title="AI explanation — coming soon">
              <SparklesIcon /> Explain
            </Button>
          </div>
        }
      />

      {query.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Learning from your wardrobe…
          </CardContent>
        </Card>
      ) : null}

      {query.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {query.error.message || "Couldn't load your preferences."}
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {query.data ? (
        <PreferencesContent
          data={query.data}
          debug={debug}
          busy={busy}
          onPin={(dimension, value) => saveOverride.mutate({ dimension, value, mode: "pin" })}
          onSuppress={(dimension, value) => saveOverride.mutate({ dimension, value, mode: "suppress" })}
          onRemoveOverride={(dimension, value) => clearOverride.mutate({ dimension, value })}
          onUnprotect={(itemId) => setFlags.mutate({ itemId, protected: false })}
          onUnavoid={(itemId) => setFlags.mutate({ itemId, avoided: false })}
        />
      ) : null}
    </div>
  );
}

function PreferencesContent({
  data,
  debug,
  busy,
  onPin,
  onSuppress,
  onRemoveOverride,
  onUnprotect,
  onUnavoid,
}: {
  data: ReturnType<typeof usePreferenceProfile>["data"] & object;
  debug: boolean;
  busy: boolean;
  onPin: (d: PreferenceDimension, v: string) => void;
  onSuppress: (d: PreferenceDimension, v: string) => void;
  onRemoveOverride: (d: PreferenceDimension, v: string) => void;
  onUnprotect: (itemId: string) => void;
  onUnavoid: (itemId: string) => void;
}) {
  const { profile, protectedItems, avoidedItems, timelines, evolution } = data;

  const sections: Section[] = [
    { title: "Preferred Colors", dimension: "color", items: profile.preferredColors },
    { title: "Preferred Brands", dimension: "brand", items: profile.preferredBrands },
    { title: "Preferred Formality", dimension: "formality", items: profile.preferredFormality },
    { title: "Preferred Footwear", dimension: "footwear", items: profile.preferredFootwear },
    { title: "Preferred Styles", dimension: "style", items: profile.preferredStyles },
    { title: "Preferred Seasons", dimension: "season", items: profile.preferredSeasons },
    { title: "Preferred Occasions", dimension: "occasion", items: profile.preferredOccasions },
  ];

  return (
    <div className="space-y-6">
      {profile.coldStart ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Still learning — there isn&apos;t much history yet, so this profile leans on sensible
            defaults. Log more wears and it will sharpen automatically.
          </span>
        </div>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div>
            <div className="text-2xl font-semibold tabular-nums">{pct(profile.confidence)}</div>
            <div className="text-xs text-muted-foreground">overall confidence</div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="text-sm text-muted-foreground">
            Derived from {profile.metadata.signalCount} behavioural signal
            {profile.metadata.signalCount === 1 ? "" : "s"}
            {profile.metadata.overrideCount > 0 ? ` · ${profile.metadata.overrideCount} override(s)` : ""}.
          </div>
        </CardContent>
      </Card>

      <ExploreExploitSelector />

      {timelines.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Taste over time</CardTitle>
            <CardDescription>
              How your top preferences have moved across recent windows (re-derived, not stored).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {timelines.map((timeline) => (
              <TimelineRow key={`${timeline.dimension}:${timeline.value}`} timeline={timeline} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.dimension} className={cn(section.items.length === 0 && "opacity-70")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {section.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing learned yet.</p>
              ) : (
                section.items.map((pref) => (
                  <PreferenceRow
                    key={`${section.dimension}:${pref.value}`}
                    pref={pref}
                    busy={busy}
                    onPin={() => onPin(section.dimension, pref.value)}
                    onSuppress={() => onSuppress(section.dimension, pref.value)}
                    onRemoveOverride={() => onRemoveOverride(section.dimension, pref.value)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ItemFlagCard
          title="Protected Items"
          description="Never suggested for removal or flagged as unused."
          items={protectedItems}
          actionLabel="Unprotect"
          onAction={onUnprotect}
          busy={busy}
        />
        <ItemFlagCard
          title="Avoided Items"
          description="Kept out of recommendations and purchase suggestions."
          items={avoidedItems}
          actionLabel="Un-avoid"
          onAction={onUnavoid}
          busy={busy}
        />
      </div>

      {debug ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Preference evolution</CardTitle>
            <CardDescription>What changed since the previous window (before → after).</CardDescription>
          </CardHeader>
          <CardContent>
            {evolution.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes since the previous window.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {evolution.map((entry, index) => (
                  <li key={`${entry.dimension}:${entry.value}:${index}`} className="font-mono">
                    <span className="capitalize">{entry.dimension}</span>:{entry.value} —{" "}
                    {entry.changes[0].before ?? "∅"} → {entry.changes[0].after ?? "∅"} ({entry.changes[0].reason})
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {debug ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Debug — raw UserPreferenceProfile</CardTitle>
            <CardDescription>Deterministic output of derivePreferenceProfileV2().</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[32rem] overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ItemFlagCard({
  title,
  description,
  items,
  actionLabel,
  onAction,
  busy,
}: {
  title: string;
  description: string;
  items: { id: string; name: string }[];
  actionLabel: string;
  onAction: (itemId: string) => void;
  busy: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">None. Mark items from their detail page.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
              <span className="truncate text-sm">{item.name}</span>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction(item.id)}>
                {actionLabel}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
