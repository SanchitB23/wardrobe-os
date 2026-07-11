"use client";

import Link from "next/link";
import { Loader2Icon } from "lucide-react";

import { useAcquisitionsHub } from "@/features/shopping/hooks";
import {
  AccuracyIntelligencePanel,
  LifecycleIntelligencePanel,
  NeedEvolutionPanel,
  RoiEvolutionPanel,
} from "@/features/shopping/components/acquisitions-intelligence-panels";
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
import { OPPORTUNITY_WEIGHTS } from "@/domain/shopping/v2";

/**
 * Developer Mode — inspect Opportunity / Need / ROI / Accuracy calculations.
 */
export function AcquisitionsDebugView() {
  const hub = useAcquisitionsHub();
  const intel = hub.data?.intelligence;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Acquisitions Intelligence Debug"
        badge={<Badge variant="secondary">Developer</Badge>}
        description="RFC-018B derived surfaces: opportunity weights, need timeline, ROI evolution, recommendation accuracy. Deterministic — AI does not score."
        actions={
          <Button variant="outline" render={<Link href="/acquisitions" />}>
            Hub
          </Button>
        }
      />

      {hub.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Loading…
          </CardContent>
        </Card>
      ) : null}

      {hub.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {hub.error.message || "Couldn't load acquisitions intelligence."}
          </CardContent>
        </Card>
      ) : null}

      {intel ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Opportunity calculation</CardTitle>
              <CardDescription>
                score = {OPPORTUNITY_WEIGHTS.priority}×018 priority +{" "}
                {OPPORTUNITY_WEIGHTS.need}×need + {OPPORTUNITY_WEIGHTS.lifecycle}
                ×lifecycle urgency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed">
                {JSON.stringify(
                  {
                    version: intel.metadata.version,
                    generatedAt: intel.metadata.generatedAt,
                    weights: OPPORTUNITY_WEIGHTS,
                    queue: intel.opportunityQueue,
                  },
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <NeedEvolutionPanel intelligence={intel} />
            <RoiEvolutionPanel intelligence={intel} />
            <AccuracyIntelligencePanel intelligence={intel} />
            <LifecycleIntelligencePanel intelligence={intel} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Full intelligence JSON</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-96 overflow-auto rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed">
                {JSON.stringify(intel, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
