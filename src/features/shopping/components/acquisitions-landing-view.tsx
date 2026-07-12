"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ChartLineIcon,
  CompassIcon,
  HistoryIcon,
  LightbulbIcon,
  ListTodoIcon,
  Loader2Icon,
  ScanSearchIcon,
  ShoppingBagIcon,
  SparklesIcon,
} from "lucide-react";

import { useAcquisitionsHub } from "@/features/shopping/hooks";
import { AcquisitionsIntelligenceSummary } from "@/features/shopping/components/acquisitions-intelligence-panels";
import { DecisionVerdictBadge } from "@/features/acquisition/components/DecisionVerdictBadge";
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

export function AcquisitionsLandingView() {
  const hub = useAcquisitionsHub();
  const data = hub.data;
  const kpis = data?.kpis;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Acquisitions"
        badge={<Badge variant="secondary">Flagship</Badge>}
        description="Wishlist, decisions, timeline, and ROI — plus continuous learning from purchase outcomes. Buy vs Skip decides; Shopping Intelligence ranks; Acquisitions Intelligence learns."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href="/acquisition/advisor" />}
            >
              <CompassIcon /> Buy vs Skip
            </Button>
            <Button render={<Link href="/acquisitions/wishlist" />}>
              <ListTodoIcon /> Wishlist
            </Button>
          </div>
        }
      />

      {hub.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Loading
            acquisitions…
          </CardContent>
        </Card>
      ) : null}

      {hub.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="py-6 text-center text-sm text-destructive">
            {hub.error.message ||
              "Couldn't load acquisitions. Wishlist / decisions migrations may not be applied yet."}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Wishlist"
          value={kpis?.wishlistActive ?? "—"}
          href="/acquisitions/wishlist"
        />
        <KpiCard
          label="Bought"
          value={kpis?.bought ?? "—"}
          href="/acquisitions/history"
        />
        <KpiCard
          label="Skipped"
          value={kpis?.skipped ?? "—"}
          href="/acquisitions/decisions"
        />
        <KpiCard
          label="ROI"
          value={kpis?.roiScore != null ? kpis.roiScore : "—"}
          href="/acquisitions/roi"
        />
        <KpiCard
          label="Impact"
          value={kpis?.impact != null ? kpis.impact : "—"}
          href="/acquisitions/decisions"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard
          href="/acquisitions/wishlist"
          icon={<ListTodoIcon className="size-5" />}
          title="Wishlist"
          description="Capture items with notes, priority, and status."
        />
        <NavCard
          href="/acquisitions/quick-analyze"
          icon={<ScanSearchIcon className="size-5" />}
          title="Quick Analyze"
          description="Run Buy vs Skip on a prospective item."
        />
        <NavCard
          href="/acquisitions/history"
          icon={<ShoppingBagIcon className="size-5" />}
          title="Shopping History"
          description="Purchases, ROI, and recommendation accuracy."
        />
        <NavCard
          href="/acquisitions/roi"
          icon={<ChartLineIcon className="size-5" />}
          title="Wardrobe ROI"
          description="Utilization and cost-per-wear of what you bought."
        />
        <NavCard
          href="/acquisitions/decisions"
          icon={<HistoryIcon className="size-5" />}
          title="Recent Decisions"
          description="History of Buy vs Skip analyses."
        />
        <NavCard
          href="/acquisitions/timeline"
          icon={<LightbulbIcon className="size-5" />}
          title="Acquisition Timeline"
          description="Wishlist → Analysis → Purchase → First Wear → ROI."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent decisions</CardTitle>
            <CardDescription>Latest Buy vs Skip snapshots.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!data || data.recentDecisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No decisions yet. Analyze an item to start the history.
              </p>
            ) : (
              data.recentDecisions.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{d.itemName}</span>
                  <DecisionVerdictBadge decision={d.decision} />
                </div>
              ))
            )}
            <Button
              variant="link"
              className="h-auto px-0"
              render={<Link href="/acquisitions/decisions" />}
            >
              View all
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Wishlist priority (yours)</CardTitle>
            <CardDescription>
              Active items by your priority — not engine ranking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!data || data.topOpportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add wishlist items to see your list.
              </p>
            ) : (
              data.topOpportunities.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{w.item.name}</span>
                  <Badge variant="secondary" className="capitalize">
                    {w.priority}
                  </Badge>
                </div>
              ))
            )}
            <Button
              variant="link"
              className="h-auto px-0"
              render={<Link href="/acquisitions/wishlist" />}
            >
              Open wishlist
            </Button>
          </CardContent>
        </Card>
      </div>

      {data?.intelligence ? (
        <AcquisitionsIntelligenceSummary intelligence={data.intelligence} />
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-start gap-2">
            <SparklesIcon className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Queue (today)</p>
              <p className="text-xs text-muted-foreground">
                RFC-018 Shopping Intelligence — priority queue, duplicates, and
                static top-N strategy.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            render={<Link href="/acquisitions/intelligence" />}
          >
            Open intelligence
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="py-4">
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function NavCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            {icon}
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
