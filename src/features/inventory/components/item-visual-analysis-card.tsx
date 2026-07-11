"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";

import {
  VISUAL_CONFIDENCE_THRESHOLD,
  visualManualDiff,
  type VisualStyleAttributes,
} from "@/domain/inventory-image-intelligence";
import {
  useAcceptItemVisualAttributesMutation,
  useAnalyzeItemPrimaryImageMutation,
  useItemVisualAttributes,
  useRejectItemVisualAttributesMutation,
} from "@/features/inventory/hooks";
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

function statusLabel(status: VisualStyleAttributes["status"] | "none") {
  switch (status) {
    case "pending":
      return "Pending review";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "stale":
      return "Stale — re-analyze";
    case "none":
      return "Not analyzed";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function ItemVisualAnalysisCard({
  itemId,
  manual,
}: {
  itemId: string;
  manual: {
    color?: string | null;
    material?: string | null;
    formality?: string | null;
    tags?: readonly string[];
  };
}) {
  const query = useItemVisualAttributes(itemId);
  const analyze = useAnalyzeItemPrimaryImageMutation(itemId);
  const accept = useAcceptItemVisualAttributesMutation(itemId);
  const reject = useRejectItemVisualAttributesMutation(itemId);

  const visual = query.data ?? null;
  const status = visual?.status ?? "none";
  const busy =
    analyze.isPending || accept.isPending || reject.isPending || query.isFetching;
  const diff = visualManualDiff(manual, visual);
  const lowConfidence =
    visual != null && visual.confidence < VISUAL_CONFIDENCE_THRESHOLD;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <SparklesIcon className="size-4" />
          Visual Analysis
        </CardTitle>
        <CardDescription>
          Vision proposes style cues from the primary photo. Manual fields always
          win — Accept only enriches StyleDNA gaps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{statusLabel(status)}</Badge>
          {visual ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              confidence {Math.round(visual.confidence * 100)}%
              {lowConfidence ? " (low — weak merge)" : ""}
            </span>
          ) : null}
        </div>

        {visual ? (
          <Progress
            value={Math.round(visual.confidence * 100)}
            className="h-1.5"
            aria-label="Visual confidence"
          />
        ) : null}

        {query.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" /> Loading…
          </p>
        ) : null}

        {visual ? (
          <ul className="space-y-1 text-sm">
            {diff.map((row) => (
              <li
                key={row.field}
                className="flex flex-wrap justify-between gap-2 border-b border-border/40 py-1"
              >
                <span className="capitalize text-muted-foreground">{row.field}</span>
                <span className="text-right">
                  <span className="text-muted-foreground">
                    {row.manual ?? "—"}
                  </span>
                  {" → "}
                  <span className={row.fillsGap ? "font-medium" : ""}>
                    {row.visual ?? "—"}
                  </span>
                  {row.fillsGap ? (
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      fills gap
                    </Badge>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No analysis yet. Run Analyze on the primary image.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={() => analyze.mutate()}
          >
            {analyze.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SparklesIcon />
            )}
            {status === "stale" || status === "none" ? "Analyze" : "Re-analyze"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !visual || visual.status === "accepted"}
            onClick={() => accept.mutate()}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || !visual || visual.status === "rejected"}
            onClick={() => reject.mutate()}
          >
            Reject
          </Button>
        </div>

        {analyze.isError ? (
          <p className="text-sm text-destructive">{analyze.error.message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
