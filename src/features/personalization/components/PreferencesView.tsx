"use client";

import { useState } from "react";
import {
  AlertTriangleIcon,
  Loader2Icon,
  PinIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";

import type { DerivedPreference, PreferenceDimension } from "@/domain/personalization";
import {
  useClearPreferenceOverride,
  usePreferenceProfile,
  useSavePreferenceOverride,
  useSetItemFlags,
} from "@/features/personalization/hooks/usePreferenceProfile";
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
      <Progress value={Math.round(pref.weight * 100)} className="h-1.5" />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span title="How sure we are now">confidence {pct(pref.confidence)}</span>
        <span aria-hidden>·</span>
        <span title="How consistently this has held over time">stability {pct(pref.stability)}</span>
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
  const { profile, protectedItems, avoidedItems } = data;

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
            <CardTitle className="text-sm">Debug — raw UserPreferenceProfile</CardTitle>
            <CardDescription>Deterministic output of derivePreferenceProfile().</CardDescription>
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
