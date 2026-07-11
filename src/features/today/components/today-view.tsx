"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  HeartPulseIcon,
  LayersIcon,
  LightbulbIcon,
  LuggageIcon,
  PlusIcon,
  SendIcon,
  ShirtIcon,
  ShoppingBagIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";

import Link from "next/link";

import {
  useInsightReport,
  useWardrobeHealth,
} from "@/features/analytics/hooks";
import { useOutfitRecommendations } from "@/features/recommendations/hooks";
import { useIntelligenceCenter } from "@/features/intelligence/hooks/useIntelligenceCenter";
import { ActionCardRow } from "@/features/intelligence/components/intelligence-center-view";
import { useExploreExploit } from "@/features/personalization/hooks/useExploreExploit";
import { useWearLogs } from "@/features/wear-logs/hooks";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

/** Hydration-safe current time (server renders neutral, client fills on mount). */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client-time read, hydration-safe
  useEffect(() => setNow(new Date()), []);
  return now;
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Loading({ lines = 2 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 text-sm text-destructive">
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" /> {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Widgets — each backed by an existing engine/service, independently degradable.
// ---------------------------------------------------------------------------

function TodaysOutfitWidget() {
  const query = useOutfitRecommendations({});
  const top = query.data?.recommendations[0] ?? null;
  const previews = query.data?.previews ?? {};

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShirtIcon className="size-4" /> Today&apos;s outfit
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            render={<a href="/recommendations">All</a>}
          />
        </div>
      </CardHeader>
      <CardContent>
        {query.isPending ? <Loading lines={3} /> : null}
        {query.isError ? (
          <ErrorLine message="Couldn't load recommendations." />
        ) : null}
        {!query.isPending && !query.isError && !top ? (
          <p className="text-sm text-muted-foreground">
            No recommendation yet — add items and outfits to get a daily pick.
          </p>
        ) : null}
        {top ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{top.name}</span>
              <Badge variant="secondary" className="tabular-nums">
                {top.score.toFixed(1)}/10
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {top.items
                .map((i) => previews[i.itemId]?.name ?? i.name)
                .join(" · ")}
            </p>
            {top.reason ? (
              <p className="text-sm text-muted-foreground">{top.reason}</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AskStylistWidget() {
  const router = useRouter();
  const [text, setText] = useState("");
  function ask() {
    const q = text.trim();
    router.push(q ? `/chat?q=${encodeURIComponent(q)}` : "/chat");
  }
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <SparklesIcon className="size-4" /> Ask the stylist
        </CardTitle>
        <CardDescription>
          Plain-language questions about your wardrobe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="What should I wear to the office today?"
            aria-label="Ask the stylist"
            className="max-h-28 min-h-[2.5rem] flex-1 resize-none"
          />
          <Button type="submit" aria-label="Ask">
            <SendIcon /> Ask
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TodaysInsightWidget() {
  const query = useInsightReport();
  const report = query.data;
  const action = report?.topActions[0] ?? null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <LightbulbIcon className="size-4" /> Today&apos;s insight
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            render={<a href="/dashboard/insights">More</a>}
          />
        </div>
      </CardHeader>
      <CardContent>
        {query.isPending ? <Loading /> : null}
        {query.isError ? <ErrorLine message="Couldn't load insights." /> : null}
        {report ? (
          <div className="space-y-1.5">
            <p className="text-sm">{report.overallSummary}</p>
            {action ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Next:</span>{" "}
                {action.title}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ShoppingSuggestionsWidget() {
  const query = useWardrobeHealth();
  const gaps = query.data?.health.gaps ?? [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBagIcon className="size-4" /> Acquisition suggestions
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/acquisitions" />}
            >
              Hub
            </Button>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/acquisition/advisor" />}
            >
              Advisor
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {query.isPending ? <Loading /> : null}
        {query.isError ? <ErrorLine message="Couldn't load gaps." /> : null}
        {query.data && gaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No gaps flagged — your wardrobe looks complete.
          </p>
        ) : null}
        {gaps.length > 0 ? (
          <ul className="space-y-1.5">
            {gaps.slice(0, 3).map((gap, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{gap.label}</span>
                {gap.detail ? (
                  <span className="text-muted-foreground"> — {gap.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WardrobeHealthWidget() {
  const query = useWardrobeHealth();
  const health = query.data?.health;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulseIcon className="size-4" /> Wardrobe health
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            render={<a href="/dashboard/health">Details</a>}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {query.isPending ? <Loading /> : null}
        {query.isError ? <ErrorLine message="Couldn't load health." /> : null}
        {health ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {Math.round(health.overallScore)}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
            <Progress
              value={Math.round(health.overallScore)}
              aria-label="Wardrobe health score"
              className="h-1.5"
            />
            {health.strengths[0] ? (
              <p className="text-sm text-muted-foreground">
                {health.strengths[0]}
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

const QUICK_ACTIONS = [
  { label: "Add item", href: "/inventory", icon: PlusIcon },
  { label: "Create outfit", href: "/outfits/new", icon: LayersIcon },
  { label: "Plan a trip", href: "/trips", icon: LuggageIcon },
  {
    label: "Recommendations",
    href: "/recommendations",
    icon: WandSparklesIcon,
  },
];

function QuickActionsWidget() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((a) => (
          <Button
            key={a.href}
            variant="outline"
            className="justify-start"
            render={<a href={a.href} />}
          >
            <a.icon /> {a.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function RecentActivityWidget() {
  const query = useWearLogs({});
  const recent = [...(query.data ?? [])]
    .sort((a, b) => (a.worn_on < b.worn_on ? 1 : -1))
    .slice(0, 5);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            render={<a href="/wear-logs">Wear logs</a>}
          />
        </div>
      </CardHeader>
      <CardContent>
        {query.isPending ? <Loading lines={3} /> : null}
        {query.isError ? (
          <ErrorLine message="Couldn't load recent wears." />
        ) : null}
        {query.data && recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wears logged yet.</p>
        ) : null}
        {recent.length > 0 ? (
          <ul className="space-y-1.5">
            {recent.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate">{log.item?.name ?? "Item"}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {log.worn_on}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** RFC-015: the Intelligence Center's top actions, led on the Today home. */
function DoThisNextSection() {
  const { mode } = useExploreExploit();
  const query = useIntelligenceCenter({ exploreExploit: mode, topN: 3 });
  const actions = query.data?.topActions ?? [];

  if (query.isError) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Do this next</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/intelligence">All</Link>}
          />
        </div>
        <CardDescription>
          Prioritised actions from every engine (RFC-015).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {query.isPending ? (
          <Loading lines={3} />
        ) : actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing urgent — your wardrobe looks healthy.
          </p>
        ) : (
          actions.map((card) => <ActionCardRow key={card.id} card={card} />)
        )}
      </CardContent>
    </Card>
  );
}

export function TodayView() {
  const now = useNow();
  const greeting = now ? greetingFor(now.getHours()) : "Welcome back";
  const dateLabel = now
    ? now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={greeting}
        badge={<Badge variant="secondary">Today</Badge>}
        description={
          dateLabel ||
          "Your wardrobe at a glance — today's outfit, insights, and what to do next."
        }
      />

      <DoThisNextSection />

      <div className="grid gap-4 lg:grid-cols-2">
        <TodaysOutfitWidget />
        <AskStylistWidget />
        <TodaysInsightWidget />
        <ShoppingSuggestionsWidget />
        <WardrobeHealthWidget />
        <QuickActionsWidget />
      </div>

      <RecentActivityWidget />
    </div>
  );
}
