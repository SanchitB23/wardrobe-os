/**
 * Developer Observability view (RFC-022) — recent in-memory structured logs.
 *
 * Process-local ring buffer only. On Vercel multi-instance serverless this is
 * best-effort; Vercel Runtime Logs remain the production source of truth.
 */

"use client";

import { useMemo, useState } from "react";
import { ActivityIcon } from "lucide-react";

import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LogKind, StructuredLogRecord } from "@/runtime/logging/log-types";

const KINDS: Array<LogKind | "all"> = ["all", "api_request", "ai_usage", "engine_trace", "app"];

function summary(record: StructuredLogRecord): string {
  switch (record.kind) {
    case "api_request":
      return `${record.method} ${record.route} → ${record.statusCode} (${record.latencyMs}ms)`;
    case "ai_usage":
      return `${record.capability} · ${record.provider}/${record.model} · ${record.status}${
        record.estimatedCostUsd != null ? ` · $${record.estimatedCostUsd.toFixed(5)}` : ""
      }`;
    case "engine_trace":
      return `${record.capability} · ${record.status} · ${record.totalLatencyMs ?? "—"}ms`;
    case "app":
      return record.message;
    default: {
      const _exhaustive: never = record;
      return String(_exhaustive);
    }
  }
}

export function ObservabilityView({ records }: { records: StructuredLogRecord[] }) {
  const [kind, setKind] = useState<LogKind | "all">("all");

  const filtered = useMemo(() => {
    if (kind === "all") return records;
    return records.filter((r) => r.kind === kind);
  }, [records, kind]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Observability"
        badge={<Badge variant="secondary">Dev</Badge>}
        description="Recent structured log lines from this server process (RFC-022). Ephemeral — use Vercel Runtime Logs in production."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ActivityIcon className="size-4" /> Recent logs
          </CardTitle>
          <CardDescription>
            Newest first · {filtered.length} shown · in-memory ring buffer (cap 200).
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={
                  kind === k
                    ? "rounded-md bg-foreground px-2 py-1 text-xs text-background"
                    : "rounded-md border px-2 py-1 text-xs text-muted-foreground"
                }
              >
                {k}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No log lines yet. Hit an API route (e.g. chat or /api/ai/test) then refresh.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((record, index) => (
                <li
                  key={`${record.timestamp}-${record.kind}-${index}`}
                  className="rounded-md border px-3 py-2 font-mono text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {record.kind}
                    </Badge>
                    <span>{record.level}</span>
                    <span>{record.timestamp}</span>
                    {record.requestId ? <span>id:{record.requestId.slice(0, 8)}…</span> : null}
                  </div>
                  <p className="mt-1 text-foreground">{summary(record)}</p>
                  {record.kind === "ai_usage" ? (
                    <p className="mt-1 text-muted-foreground">
                      tokens {record.totalTokens ?? "—"} · fallback{" "}
                      {record.usedFallback ? "yes" : "no"}
                      {record.errorCode ? ` · err ${record.errorCode}` : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
