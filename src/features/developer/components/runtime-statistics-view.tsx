/**
 * Runtime Statistics — consolidated AI + Weather process metrics.
 */

import Link from "next/link";
import { GaugeIcon } from "lucide-react";

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
import type { AIRuntimeMetricsSnapshot } from "@/runtime/ai";
import type { WeatherMetricsSnapshot } from "@/runtime/weather";

export function RuntimeStatisticsView({
  ai,
  weather,
}: {
  ai: AIRuntimeMetricsSnapshot;
  weather: WeatherMetricsSnapshot;
}) {
  const vision = ai.byCapabilityProvider.filter((r) => r.capability === "vision");
  const explanation = ai.byCapabilityProvider.filter(
    (r) => r.capability === "explanation",
  );
  const conversation = ai.byCapabilityProvider.filter(
    (r) => r.capability === "conversation",
  );
  const structured = ai.byCapabilityProvider.filter(
    (r) => r.capability === "structured",
  );

  const sumReqs = (rows: typeof ai.byCapabilityProvider) =>
    rows.reduce((s, r) => s + r.requests, 0);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Runtime Statistics"
        badge={<Badge variant="secondary">Dev</Badge>}
        description="Process-local aggregates for AI Runtime and Weather Runtime. Deep links to full dashboards."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" render={<Link href="/developer/ai-runtime" />}>
              AI Runtime
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/developer/weather" />}>
              Weather
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="AI requests" value={String(ai.totalRequests)} />
        <StatCard label="AI spend $" value={ai.totalCostUsd.toFixed(4)} />
        <StatCard label="Fallbacks" value={String(ai.totalFallbacks)} />
        <StatCard label="Cache savings $" value={ai.totalCacheSavingsUsd.toFixed(4)} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GaugeIcon className="size-4" /> Feature runtime metrics
          </CardTitle>
          <CardDescription>
            Vision (incl. inventory image intelligence), Lifestyle/Shopping
            explanations, conversation, and structured playground.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 text-sm">
            <li>Vision requests: <strong>{sumReqs(vision)}</strong></li>
            <li>Explanation (Lifestyle / Shopping / Reco): <strong>{sumReqs(explanation)}</strong></li>
            <li>Conversation (chat): <strong>{sumReqs(conversation)}</strong></li>
            <li>Structured (playground / test): <strong>{sumReqs(structured)}</strong></li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Weather Runtime</CardTitle>
          <CardDescription>
            Provider fetches since restart (in-memory). Structured weather_request
            lines also emit to logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="space-y-1">
            <li>
              Requests: <strong>{weather.totalRequests}</strong> · cache hits:{" "}
              <strong>{weather.cacheHits}</strong> · misses:{" "}
              <strong>{weather.cacheMisses}</strong>
            </li>
            <li>
              Provider errors: <strong>{weather.providerErrors}</strong> · avg latency:{" "}
              <strong>{weather.avgLatencyMs ?? "—"}</strong> ms · last provider:{" "}
              <strong>{weather.lastProvider ?? "—"}</strong>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
