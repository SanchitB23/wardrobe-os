/**
 * Developer Observability view (RFC-022) — recent in-memory structured logs +
 * request trace grouping.
 */

"use client";

import { useMemo, useState } from "react";
import { ActivityIcon, SearchIcon } from "lucide-react";

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
import type { LogKind, StructuredLogRecord } from "@/runtime/logging/log-types";

const KINDS: Array<LogKind | "all"> = [
  "all",
  "api_request",
  "ai_usage",
  "engine_trace",
  "weather_request",
  "app",
];

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
    case "weather_request":
      return `${record.provider} · ${record.status}${record.cached ? " · cached" : ""} · ${record.latencyMs}ms`;
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
  const [requestIdQuery, setRequestIdQuery] = useState("");
  const [traceId, setTraceId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = records;
    if (kind !== "all") list = list.filter((r) => r.kind === kind);
    const q = requestIdQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => (r.requestId ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [records, kind, requestIdQuery]);

  const traceLines = useMemo(() => {
    if (!traceId) return [];
    return records
      .filter((r) => r.requestId === traceId)
      .slice()
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [records, traceId]);

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
            <SearchIcon className="size-4" /> Request Trace
          </CardTitle>
          <CardDescription>
            Filter by requestId, then open a trace to see api → ai → weather →
            engine lines in time order.
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Input
              value={requestIdQuery}
              onChange={(e) => setRequestIdQuery(e.target.value)}
              placeholder="Filter requestId…"
              className="max-w-sm font-mono text-xs"
            />
            {traceId ? (
              <Button size="sm" variant="outline" onClick={() => setTraceId(null)}>
                Clear trace
              </Button>
            ) : null}
          </div>
        </CardHeader>
        {traceId ? (
          <CardContent>
            <p className="mb-2 font-mono text-xs text-muted-foreground">{traceId}</p>
            {traceLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lines for this id in the buffer.</p>
            ) : (
              <ol className="space-y-2 border-l pl-4">
                {traceLines.map((record, index) => (
                  <li key={`${record.timestamp}-${index}`} className="relative text-xs">
                    <span className="absolute -left-[1.15rem] top-1 size-2 rounded-full bg-foreground" />
                    <div className="flex flex-wrap gap-2 text-muted-foreground">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {record.kind}
                      </Badge>
                      <span>{record.timestamp}</span>
                    </div>
                    <p className="mt-0.5 font-mono text-foreground">{summary(record)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        ) : null}
      </Card>

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
                    {record.requestId ? (
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline"
                        onClick={() => {
                          setTraceId(record.requestId);
                          setRequestIdQuery(record.requestId ?? "");
                        }}
                      >
                        id:{record.requestId.slice(0, 8)}…
                      </button>
                    ) : null}
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
