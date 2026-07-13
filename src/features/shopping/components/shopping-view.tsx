"use client";

import React, { useId, useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckIcon,
  Loader2Icon,
  PlusIcon,
  ScanSearchIcon,
  ShoppingBagIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import type { ProspectiveItem } from "@/domain/acquisition";
import type { ShoppingDashboard } from "@/features/shopping/types";
import {
  useSaveWishlistMutation,
  useShoppingDashboard,
  useWishlist,
  useWishlistStatusMutation,
} from "@/features/shopping/hooks";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const decisionVariant = (d: string) =>
  d === "buy" ? "default" : d === "consider" ? "secondary" : "outline";

export function ShoppingView() {
  const dashboard = useShoppingDashboard();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Shopping Intelligence"
        badge={<Badge variant="secondary">Intelligence</Badge>}
        description="Priority queue, wardrobe ROI, duplicates, and strategy. Acquisition decides each item; Shopping Intelligence ranks and aggregates. Product hub lives at Acquisitions."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/acquisitions" />}>
              Acquisitions hub
            </Button>
            <Button
              variant="outline"
              render={<Link href="/acquisition/advisor" />}
            >
              <ScanSearchIcon /> Buy vs Skip
            </Button>
          </div>
        }
      />

      {dashboard.data ? (
        <p className="text-sm text-muted-foreground">
          {dashboard.data.insights.summary}
        </p>
      ) : null}

      <Tabs defaultValue="priority">
        <TabsList>
          <TabsTrigger value="priority">Priority</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
          <TabsTrigger value="roi">ROI</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
        </TabsList>

        <TabsContent value="priority">
          <PriorityTab
            dashboard={dashboard.data}
            loading={dashboard.isPending}
            error={dashboard.error}
          />
        </TabsContent>
        <TabsContent value="wishlist">
          <WishlistTab />
        </TabsContent>
        <TabsContent value="roi">
          <RoiTab dashboard={dashboard.data} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab dashboard={dashboard.data} />
        </TabsContent>
        <TabsContent value="duplicates">
          <DuplicatesTab dashboard={dashboard.data} />
        </TabsContent>
        <TabsContent value="strategy">
          <StrategyTab dashboard={dashboard.data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StateCard({
  loading,
  error,
  empty,
}: {
  loading?: boolean;
  error?: Error | null;
  empty?: string;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" /> Loading…
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-8 text-center text-sm text-destructive">
          {error.message || "Something went wrong."}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        {empty}
      </CardContent>
    </Card>
  );
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
        {label}
      </div>
    </div>
  );
}

function PriorityTab({
  dashboard,
  loading,
  error,
}: {
  dashboard: ShoppingDashboard | undefined;
  loading: boolean;
  error: Error | null;
}) {
  if (!dashboard) return <StateCard loading={loading} error={error} />;
  if (dashboard.priority.length === 0) {
    return (
      <StateCard empty="No active wishlist items to prioritise. Add items in the Wishlist tab." />
    );
  }
  return (
    <div className="space-y-2">
      {dashboard.priority.map((rec, i) => (
        <Card key={rec.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold tabular-nums text-muted-foreground">
                #{i + 1}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{rec.item.name}</span>
                  <Badge
                    variant={decisionVariant(rec.analysis.decision)}
                    className="capitalize"
                  >
                    {rec.analysis.decision}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {rec.item.category}
                  {rec.scores.reasonCodes.length > 0
                    ? ` · ${rec.scores.reasonCodes.join(", ")}`
                    : ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ScoreChip label="need" value={rec.scores.need} />
              <ScoreChip label="impact" value={rec.scores.impact} />
              <ScoreChip label="buy" value={rec.scores.buy} />
              <div className="text-center">
                <div className="text-xl font-semibold tabular-nums">
                  {rec.scores.priority}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  priority
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function WishlistTab() {
  const wishlist = useWishlist();
  const save = useSaveWishlistMutation();
  const status = useWishlistStatusMutation();

  const items = wishlist.data ?? [];
  const active = items.filter((i) => i.status === "active");
  const archived = items.filter((i) => i.status !== "active");

  return (
    <div className="space-y-4">
      <AddWishlistForm
        onAdd={(item) => save.mutate({ item })}
        pending={save.isPending}
      />

      {wishlist.isPending ? (
        <StateCard loading />
      ) : items.length === 0 ? (
        <StateCard empty="Your wishlist is empty. Add an item above or capture one from a screenshot." />
      ) : (
        <div className="space-y-2">
          {active.map((w) => (
            <Card key={w.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <div className="text-sm font-medium">{w.item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[w.item.category, w.item.color, w.item.formality]
                      .filter(Boolean)
                      .join(" · ")}
                    {w.item.estimatedPrice != null
                      ? ` · ${w.item.estimatedPrice}`
                      : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={status.isPending}
                    onClick={() =>
                      status.mutate({ id: w.id, action: "purchased" })
                    }
                  >
                    <CheckIcon /> Purchased
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={status.isPending}
                    onClick={() =>
                      status.mutate({ id: w.id, action: "dismissed" })
                    }
                  >
                    <XIcon /> Dismiss
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete"
                    disabled={status.isPending}
                    onClick={() =>
                      status.mutate({ id: w.id, action: "delete" })
                    }
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {archived.length > 0 ? (
            <div className="pt-2">
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground/70">
                Purchased / dismissed
              </div>
              {archived.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground"
                >
                  <span>
                    {w.item.name}{" "}
                    <Badge variant="outline" className="ml-1 capitalize">
                      {w.status}
                    </Badge>
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete"
                    onClick={() =>
                      status.mutate({ id: w.id, action: "delete" })
                    }
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AddWishlistForm({
  onAdd,
  pending,
}: {
  onAdd: (item: ProspectiveItem) => void;
  pending: boolean;
}) {
  const nameId = useId();
  const catId = useId();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [price, setPrice] = useState("");

  const canAdd = name.trim() !== "" && category.trim() !== "" && !pending;

  function add() {
    onAdd({
      name: name.trim(),
      category: category.trim(),
      color: color.trim() || null,
      estimatedPrice: price ? Number(price) : null,
    });
    setName("");
    setCategory("");
    setColor("");
    setPrice("");
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Add to wishlist</CardTitle>
        <CardDescription>
          A prospective item. Buy vs Skip evaluates it; the queue ranks it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label id={nameId} className="text-xs text-muted-foreground">
              Name
            </Label>
            <Input
              aria-labelledby={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Navy blazer"
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label id={catId} className="text-xs text-muted-foreground">
              Category
            </Label>
            <Input
              aria-labelledby={catId}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="blazer"
              className="w-32"
            />
          </div>
          <Input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="Color"
            className="w-28"
            aria-label="Color"
          />
          <Input
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
            className="w-24"
            aria-label="Estimated price"
          />
          <Button disabled={!canAdd} onClick={add}>
            {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}{" "}
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RoiTab({ dashboard }: { dashboard: ShoppingDashboard | undefined }) {
  if (!dashboard) return <StateCard loading />;
  const { roi } = dashboard;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Wardrobe ROI</CardTitle>
          <CardDescription>
            Utilization of what you&apos;ve bought — are you buying well?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress
            value={roi.wardrobeRoiScore}
            aria-label="Wardrobe ROI"
            className="h-1.5"
          />
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <span className="font-semibold tabular-nums">
                {roi.wardrobeRoiScore}
              </span>{" "}
              <span className="text-muted-foreground">ROI score</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums">
                {roi.totalSpend}
              </span>{" "}
              <span className="text-muted-foreground">total spend</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums">
                {roi.averageCostPerWear ?? "—"}
              </span>{" "}
              <span className="text-muted-foreground">avg cost/wear</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {roi.projected.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Projected cost-per-wear</CardTitle>
            <CardDescription>For items in your priority queue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {roi.projected.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span>{p.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {p.estimatedCostPerWear ?? "—"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function HistoryTab({
  dashboard,
}: {
  dashboard: ShoppingDashboard | undefined;
}) {
  if (!dashboard) return <StateCard loading />;
  const realized = dashboard.roi.realized;
  if (realized.length === 0)
    return <StateCard empty="No purchase history yet." />;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Purchase history</CardTitle>
        <CardDescription>
          Realized cost-per-wear across what you own.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {realized.map((r) => (
          <div
            key={r.itemId}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span>{r.name}</span>
            <span className="tabular-nums text-muted-foreground">
              {r.price ?? "—"} · {r.wears} wears · {r.costPerWear ?? "—"}/wear
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DuplicatesTab({
  dashboard,
}: {
  dashboard: ShoppingDashboard | undefined;
}) {
  if (!dashboard) return <StateCard loading />;
  const { duplicates } = dashboard;
  if (duplicates.clusters.length === 0)
    return (
      <StateCard empty="No duplicates detected across your wishlist and wardrobe." />
    );
  return (
    <div className="space-y-2">
      {duplicates.clusters.map((c, i) => (
        <Card key={i} className="border-amber-500/30">
          <CardContent className="space-y-1 py-3">
            <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />{" "}
              {c.reason}
            </p>
            <div className="flex flex-wrap gap-1.5 pl-6">
              {c.members.map((m) => (
                <Badge
                  key={`${m.kind}-${m.id}`}
                  variant="outline"
                  className="text-[10px]"
                >
                  {m.kind}: {m.name}
                </Badge>
              ))}
              <Badge variant="secondary" className="text-[10px]">
                {Math.round(c.overlap * 100)}% overlap
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StrategyTab({
  dashboard,
}: {
  dashboard: ShoppingDashboard | undefined;
}) {
  if (!dashboard) return <StateCard loading />;
  if (dashboard.strategy.length === 0)
    return <StateCard empty="Add wishlist items to get a shopping strategy." />;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <ShoppingBagIcon className="size-4" /> What to buy next
        </CardTitle>
        <CardDescription>
          Sequenced by priority. Each verdict comes from Buy vs Skip.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {dashboard.strategy.map((step) => (
          <div
            key={step.rank}
            className="flex items-start gap-3 rounded-lg border p-3"
          >
            <span className="text-lg font-semibold tabular-nums text-muted-foreground">
              {step.rank}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{step.name}</span>
                <Badge
                  variant={decisionVariant(step.action)}
                  className="capitalize"
                >
                  {step.action}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{step.reason}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
