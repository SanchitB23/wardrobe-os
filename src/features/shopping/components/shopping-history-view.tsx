"use client";

import Link from "next/link";
import { Loader2Icon } from "lucide-react";

import { useAcquisitionsHub } from "@/features/shopping/hooks";
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

export function ShoppingHistoryView() {
  const hub = useAcquisitionsHub();
  const history = hub.data?.shoppingHistory;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Shopping History"
        badge={<Badge variant="secondary">Acquisitions</Badge>}
        description="Purchased wishlist items, realized ROI, and how often Buy vs Skip lined up with what you did."
        actions={
          <Button variant="outline" render={<Link href="/acquisitions" />}>
            Hub
          </Button>
        }
      />

      {hub.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Loading history…
          </CardContent>
        </Card>
      ) : null}

      {hub.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {hub.error.message || "Couldn't load shopping history."}
          </CardContent>
        </Card>
      ) : null}

      {history ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-semibold tabular-nums">
                  {history.purchasedWishlist.length}
                </div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Purchased (wishlist)
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-semibold tabular-nums">
                  {history.realized.length}
                </div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Realized purchases
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-semibold tabular-nums">
                  {history.accuracyPercent != null
                    ? `${history.accuracyPercent}%`
                    : "—"}
                </div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Recommendation accuracy
                  {history.accuracySampleSize > 0
                    ? ` (n=${history.accuracySampleSize})`
                    : ""}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Purchased from wishlist</CardTitle>
              <CardDescription>
                Items you marked purchased in Acquisitions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {history.purchasedWishlist.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No purchased wishlist items yet.
                </p>
              ) : (
                history.purchasedWishlist.map((w) => (
                  <div
                    key={w.id}
                    className="flex justify-between gap-2 text-sm"
                  >
                    <span>{w.item.name}</span>
                    <span className="text-muted-foreground">
                      {w.item.category}
                      {w.item.estimatedPrice != null
                        ? ` · ${w.item.estimatedPrice}`
                        : ""}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Analysis · ROI</CardTitle>
              <CardDescription>
                Realized cost-per-wear from wardrobe purchases.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {history.realized.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No purchase ROI data yet.
                </p>
              ) : (
                history.realized.map((r) => (
                  <div
                    key={r.itemId}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>{r.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {r.price ?? "—"} · {r.wears} wears ·{" "}
                      {r.costPerWear ?? "—"}/wear
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recommendation accuracy</CardTitle>
              <CardDescription>
                Among buy/skip decisions later matched to purchased/dismissed
                wishlist items: buy→purchased and skip→dismissed count as hits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {history.accuracyPercent != null
                  ? `${history.accuracyPercent}% accurate across ${history.accuracySampleSize} outcomes.`
                  : "Not enough matched outcomes yet — analyze items, then mark them purchased or dismissed."}
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
