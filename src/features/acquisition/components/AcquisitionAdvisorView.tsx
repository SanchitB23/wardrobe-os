"use client";

import { CompassIcon, Loader2Icon, ShoppingBagIcon } from "lucide-react";

import { PageHeader } from "@/features/layout";
import { useBuyVsSkip } from "@/features/acquisition/hooks/useBuyVsSkip";
import { BuyVsSkipResult } from "@/features/acquisition/components/BuyVsSkipResult";
import { ProspectiveItemForm } from "@/features/acquisition/components/ProspectiveItemForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AcquisitionAdvisorView() {
  const analyze = useBuyVsSkip();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Buy vs Skip Advisor"
        badge={<Badge variant="secondary">Acquisition</Badge>}
        description="Should you buy it? Enter a prospective item and get a deterministic verdict scored against your wardrobe — gaps, duplicates, outfits, usage, and cost. Engines decide; AI does not."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prospective item</CardTitle>
            <CardDescription>Name and category are required; the rest sharpens the verdict.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProspectiveItemForm onAnalyze={analyze.mutate} isAnalyzing={analyze.isPending} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {analyze.isPending ? (
            <Card>
              <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
                <Loader2Icon className="size-5 animate-spin" />
                Scoring against your wardrobe…
              </CardContent>
            </Card>
          ) : null}

          {analyze.isError ? (
            <Card className="border-destructive/30">
              <CardContent className="py-8 text-center text-sm text-destructive">
                {analyze.error.message || "Couldn't run the analysis."}
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => analyze.reset()}>
                    Try again
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!analyze.isPending && !analyze.isError && analyze.data ? (
            <BuyVsSkipResult analysis={analyze.data} />
          ) : null}

          {!analyze.isPending && !analyze.isError && !analyze.data ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <ShoppingBagIcon className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="flex items-center justify-center gap-1.5 font-medium text-foreground">
                    <CompassIcon className="size-4" />
                    Ready when you are
                  </p>
                  <p className="max-w-sm text-sm">
                    Fill in an item on the left and press Analyze to see whether it&apos;s worth
                    buying for your wardrobe.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
