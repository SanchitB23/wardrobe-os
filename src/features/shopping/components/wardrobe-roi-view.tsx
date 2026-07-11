"use client";

import Link from "next/link";
import { Loader2Icon } from "lucide-react";

import { useAcquisitionsHub } from "@/features/shopping/hooks";
import { RoiEvolutionPanel } from "@/features/shopping/components/acquisitions-intelligence-panels";
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

export function WardrobeRoiView() {
  const hub = useAcquisitionsHub();
  const roi = hub.data?.roi;
  const intelligence = hub.data?.intelligence;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Wardrobe ROI"
        badge={<Badge variant="secondary">Acquisitions</Badge>}
        description="Snapshot utilization plus ROI evolution over purchase history and category cohorts."
        actions={
          <Button variant="outline" render={<Link href="/acquisitions" />}>
            Hub
          </Button>
        }
      />

      {hub.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Loading ROI…
          </CardContent>
        </Card>
      ) : null}

      {hub.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {hub.error.message || "Couldn't load ROI."}
          </CardContent>
        </Card>
      ) : null}

      {roi ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Utilization score</CardTitle>
              <CardDescription>
                Share of purchases that have been worn at least once.
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Realized cost-per-wear</CardTitle>
              <CardDescription>
                Owned purchases linked to wardrobe items.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {roi.realized.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No purchase history yet.
                </p>
              ) : (
                roi.realized.map((r) => (
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

          {intelligence ? (
            <RoiEvolutionPanel intelligence={intelligence} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
