/**
 * Request Replay developer utility — sanitized API metadata only.
 */

"use client";

import { useState } from "react";
import { RefreshCwIcon } from "lucide-react";

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
import type { ReplayCapture } from "@/runtime/logging/request-replay";

export function RequestReplayView({
  captures,
  captureEnabled,
}: {
  captures: ReplayCapture[];
  captureEnabled: boolean;
}) {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function replay(capture: ReplayCapture) {
    if (capture.method !== "GET") {
      setResult(
        `Only GET can be auto-replayed. Use: curl -i -X ${capture.method} "${capture.route}" -H "x-request-id: ${capture.requestId}"`,
      );
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(capture.route, {
        method: "GET",
        headers: { "x-request-id": capture.requestId },
      });
      const text = await res.text();
      setResult(
        `${res.status} ${res.statusText}\nx-request-id: ${res.headers.get("x-request-id") ?? "—"}\n\n${text.slice(0, 2000)}`,
      );
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Request Replay"
        badge={<Badge variant="secondary">Dev</Badge>}
        description="Process-local sanitized API completions. No bodies or secrets. Enable with REPLAY_CAPTURE=true (non-production only)."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCwIcon className="size-4" /> Captures
          </CardTitle>
          <CardDescription>
            Capture {captureEnabled ? "enabled" : "disabled"} · {captures.length} stored
            (cap 50). Refresh the page after API traffic.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!captureEnabled ? (
            <p className="text-sm text-muted-foreground">
              Set <code className="rounded bg-muted px-1 text-xs">REPLAY_CAPTURE=true</code> in
              `.env.local` and restart the dev server.
            </p>
          ) : null}
          {captures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No captures yet.</p>
          ) : (
            <ul className="space-y-2">
              {captures.map((c) => (
                <li
                  key={`${c.requestId}-${c.capturedAt}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-mono text-xs">
                      {c.method} {c.route} → {c.statusCode} ({c.latencyMs}ms)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.requestId} · {c.capturedAt}
                      {c.errorCode ? ` · ${c.errorCode}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => replay(c)}
                  >
                    Replay
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {result ? (
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
              {result}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
