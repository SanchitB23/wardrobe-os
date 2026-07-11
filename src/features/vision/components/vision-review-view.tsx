"use client";

import Link from "next/link";
import {
  CheckIcon,
  ClipboardCheckIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";

import {
  useClearVisionSession,
  useVisionReviewMutation,
  useVisionSession,
} from "@/features/vision/hooks";
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

const kindLabel: Record<string, string> = {
  add_item: "Add item",
  log_wear: "Log wear",
  flag_duplicate: "Duplicate",
  skip: "Review",
};

export function VisionReviewView() {
  const session = useVisionSession();
  const review = useVisionReviewMutation();
  const clear = useClearVisionSession();
  const data = session.data;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Review Queue"
        badge={<Badge variant="secondary">Vision</Badge>}
        description="Confirm or dismiss every action. Wear logs write only on confirm. Add-item confirms mark intent — create the item in Inventory yourself."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/vision/scan" />}>
              New scan
            </Button>
            <Button variant="ghost" onClick={clear}>
              Clear session
            </Button>
          </div>
        }
      />

      {session.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Loading session…
          </CardContent>
        </Card>
      ) : null}

      {!session.isPending && !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardCheckIcon className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No review session yet. Run a closet or outfit scan first.
            </p>
            <Button render={<Link href="/vision/scan" />}>Scan</Button>
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Pending" value={data.queue.pendingCount} />
            <Stat label="Confirmed" value={data.queue.confirmedCount} />
            <Stat label="Dismissed" value={data.queue.dismissedCount} />
          </div>

          {data.closetScan ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Closet scan summary</CardTitle>
                <CardDescription>
                  {data.closetScan.newCount} new · {data.closetScan.possibleMatchCount}{" "}
                  possible matches · {data.closetScan.duplicateCount} duplicates
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {data.outfit ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Outfit recognition</CardTitle>
                <CardDescription>
                  {data.outfit.matchedCount} matched · {data.outfit.unmatchedCount}{" "}
                  unmatched · confidence{" "}
                  {Math.round(data.outfit.overallConfidence * 100)}%
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <div className="space-y-2">
            {data.queue.items.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <Badge variant="outline">{kindLabel[item.kind] ?? item.kind}</Badge>
                      <Badge variant="secondary" className="capitalize">
                        {item.status}
                      </Badge>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                    {item.detail ? (
                      <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                    ) : null}
                  </div>
                  {item.status === "pending" ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: item.id, action: "confirm" })}
                      >
                        <CheckIcon /> Confirm
                      </Button>
                      {item.kind === "add_item" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <Link
                              href={`/inventory?action=add-item&name=${encodeURIComponent(item.suggestedName ?? "")}&category=${encodeURIComponent(item.suggestedCategory ?? "")}`}
                            />
                          }
                        >
                          Open Inventory
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: item.id, action: "dismiss" })}
                      >
                        <XIcon /> Dismiss
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
