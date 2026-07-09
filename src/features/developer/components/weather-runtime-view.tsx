import { CloudSunIcon } from "lucide-react";

import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WeatherMetricsSnapshot } from "@/runtime/weather";
import type { WeatherSnapshot } from "@/domain/weather";

/** Presentational (server-rendered) Weather Runtime developer view (RFC-011). */
export function WeatherRuntimeView({
  provider,
  ttlMinutes,
  metrics,
  snapshot,
}: {
  provider: string;
  ttlMinutes: number;
  metrics: WeatherMetricsSnapshot;
  snapshot: WeatherSnapshot;
}) {
  const rows: [string, string][] = [
    ["Current provider", provider],
    ["Cache TTL", `${ttlMinutes} min`],
    ["Total requests", String(metrics.totalRequests)],
    ["Cache hits", String(metrics.cacheHits)],
    ["Cache misses", String(metrics.cacheMisses)],
    ["Provider errors", String(metrics.providerErrors)],
    ["Last provider", metrics.lastProvider ?? "—"],
    ["Last latency", metrics.lastLatencyMs != null ? `${metrics.lastLatencyMs} ms` : "—"],
    ["Avg latency", metrics.avgLatencyMs != null ? `${metrics.avgLatencyMs} ms` : "—"],
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Weather Runtime"
        badge={<Badge variant="secondary">Dev</Badge>}
        description="The single deterministic weather source. Weather is data; the engines decide; AI explains. In-memory metrics (no database)."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudSunIcon className="size-4" /> Runtime + cache metrics
          </CardTitle>
          <CardDescription>Process-local counters since the last restart.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="tabular-nums font-medium">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Current WeatherSnapshot</CardTitle>
          <CardDescription>
            The narrow, engine-facing projection recommendation consumes.
            Source: <Badge variant="outline">{snapshot.source}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Season / condition</span>
            <span className="font-medium">{snapshot.season} · {snapshot.condition}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Temp / feels-like</span>
            <span className="font-medium tabular-nums">
              {snapshot.temperatureC ?? "—"}°C / {snapshot.feelsLikeC ?? "—"}°C
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Rain risk / confidence</span>
            <span className="font-medium tabular-nums">
              {snapshot.rainRisk != null ? `${Math.round(snapshot.rainRisk * 100)}%` : "—"} ·{" "}
              {Math.round(snapshot.confidence * 100)}%
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {snapshot.labels.map((label) => (
              <Badge key={label} variant="outline" className="text-[10px]">{label}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
