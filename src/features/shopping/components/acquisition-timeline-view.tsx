"use client";

import Link from "next/link";
import { Loader2Icon } from "lucide-react";

import { TIMELINE_STAGE_LABELS, TIMELINE_STAGE_ORDER } from "@/domain/shopping";
import { useAcquisitionsHub } from "@/features/shopping/hooks";
import { LifecycleIntelligencePanel } from "@/features/shopping/components/acquisitions-intelligence-panels";
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

export function AcquisitionTimelineView() {
  const hub = useAcquisitionsHub();
  const subjects = hub.data?.timeline ?? [];
  const intelligence = hub.data?.intelligence;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Acquisition Timeline"
        badge={<Badge variant="secondary">Acquisitions</Badge>}
        description="Hub stages (Wishlist → ROI) plus Purchase Lifecycle learning states (established / low usage / retired)."
        actions={
          <Button variant="outline" render={<Link href="/acquisitions" />}>
            Hub
          </Button>
        }
      />

      {intelligence ? (
        <LifecycleIntelligencePanel intelligence={intelligence} />
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Hub stages</CardTitle>
          <CardDescription>
            Product UX stages — complementary to 018B lifecycle above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-wrap gap-2 text-sm">
            {TIMELINE_STAGE_ORDER.map((stage, i) => (
              <li key={stage} className="flex items-center gap-2">
                {i > 0 ? (
                  <span className="text-muted-foreground">→</span>
                ) : null}
                <Badge variant="outline">{TIMELINE_STAGE_LABELS[stage]}</Badge>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {hub.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Loading timeline…
          </CardContent>
        </Card>
      ) : null}

      {hub.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {hub.error.message || "Couldn't load timeline."}
          </CardContent>
        </Card>
      ) : null}

      {hub.data && subjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No wishlist items yet. Add items to see them move through the
            lifecycle.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        {subjects.map((s) => (
          <Card key={s.id}>
            <CardContent className="space-y-3 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{s.name}</span>
                    <Badge variant="secondary" className="capitalize">
                      {s.priority}
                    </Badge>
                    {s.decision ? (
                      <Badge variant="outline" className="capitalize">
                        {s.decision}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.category ?? "—"}
                    {s.wears > 0 ? ` · ${s.wears} wears` : ""}
                    {s.costPerWear != null ? ` · ${s.costPerWear}/wear` : ""}
                  </div>
                </div>
                <Badge>{TIMELINE_STAGE_LABELS[s.stage]}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TIMELINE_STAGE_ORDER.map((stage) => {
                  const reached = s.stagesReached.includes(stage);
                  return (
                    <span
                      key={stage}
                      className={
                        reached
                          ? "rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                          : "rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      }
                    >
                      {TIMELINE_STAGE_LABELS[stage]}
                    </span>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
