/**
 * AI Runtime developer view (RFC-014 / observability audit follow-up).
 * Presentational — server-rendered with process-local metrics.
 */

import { NetworkIcon, WalletIcon } from "lucide-react";

import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AIRuntimeMetricsSnapshot, BudgetStatus, RouteDescription } from "@/runtime/ai";

const FEATURE_CAPABILITIES = [
  "explanation",
  "vision",
  "conversation",
  "structured",
  "classification",
] as const;

/** Presentational (server-rendered) AI Runtime v2 developer view (RFC-014 / 014A / 014B). */
export function AIRuntimeView({
  routes,
  metrics,
  providers,
  budget,
}: {
  routes: RouteDescription[];
  metrics: AIRuntimeMetricsSnapshot;
  providers: string[];
  budget: BudgetStatus;
}) {
  const pct =
    budget.hardStopUsd > 0
      ? Math.min(100, Math.round((budget.spentUsd / budget.hardStopUsd) * 100))
      : 0;
  const remaining = Math.max(0, budget.hardStopUsd - budget.spentUsd);

  const byCapability = FEATURE_CAPABILITIES.map((cap) => {
    const rows = metrics.byCapabilityProvider.filter((r) => r.capability === cap);
    return {
      capability: cap,
      requests: rows.reduce((s, r) => s + r.requests, 0),
      spend: rows.reduce((s, r) => s + r.estCostUsd, 0),
      fallbacks: rows.reduce((s, r) => s + r.fallbacks, 0),
      savings: rows.reduce((s, r) => s + r.cacheSavingsUsd, 0),
    };
  }).filter((r) => r.requests > 0);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="AI Runtime"
        badge={<Badge variant="secondary">Dev</Badge>}
        description="Cost-first capability routing (RFC-014 / 014A). Production explanations, playground, and vision metrics flow through this runtime. It routes and measures; it never decides."
      />

      {/* Cost dashboard */}
      <Card className={budget.available ? "" : "border-destructive/40"}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <WalletIcon className="size-4" /> Cost dashboard
            {budget.available ? (
              <Badge variant="outline">available</Badge>
            ) : (
              <Badge variant="destructive">hard stop — falling back to Gemini</Badge>
            )}
            {budget.softAlertReached && budget.available ? (
              <Badge variant="secondary">soft alert</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Estimated month-to-date OpenAI spend (process-local since restart —
            directional, not billed). Gemini is never blocked by this budget.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={pct} aria-label="OpenAI budget usage" className="h-1.5" />
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <span className="font-semibold tabular-nums">${budget.spentUsd.toFixed(4)}</span>{" "}
              <span className="text-muted-foreground">est. OpenAI spent (MTD)</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums">${remaining.toFixed(4)}</span>{" "}
              <span className="text-muted-foreground">budget remaining</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums">
                ${metrics.totalCostUsd.toFixed(4)}
              </span>{" "}
              <span className="text-muted-foreground">all-provider spend</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums">
                ${metrics.totalCacheSavingsUsd.toFixed(4)}
              </span>{" "}
              <span className="text-muted-foreground">cache savings</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums">{metrics.totalFallbacks}</span>{" "}
              <span className="text-muted-foreground">fallbacks</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums">${budget.softAlertUsd.toFixed(2)}</span>{" "}
              <span className="text-muted-foreground">soft alert</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums">${budget.hardStopUsd.toFixed(2)}</span>{" "}
              <span className="text-muted-foreground">hard stop</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Capability → provider → model */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <NetworkIcon className="size-4" /> Capability routing
          </CardTitle>
          <CardDescription>
            Registered providers: {providers.join(", ") || "—"}. Override per capability with
            <code className="mx-1 rounded bg-muted px-1 text-xs">AI_POLICY_&lt;CAP&gt;=primary,fallback</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Capability</th>
                  <th className="py-1 pr-3 font-medium">Provider</th>
                  <th className="py-1 pr-3 font-medium">Model</th>
                  <th className="py-1 pr-3 font-medium">Fallback</th>
                  <th className="py-1 font-medium">Active now</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((row) => {
                  const degraded =
                    row.activeProvider !== null && row.activeProvider !== row.provider;
                  return (
                    <tr key={row.capability} className="border-t">
                      <td className="py-1 pr-3 capitalize">
                        {row.capability.replace(/_/g, " ")}
                      </td>
                      <td className="py-1 pr-3">
                        <Badge variant="outline">{row.provider}</Badge>
                      </td>
                      <td className="py-1 pr-3 font-mono text-xs">{row.model}</td>
                      <td className="py-1 pr-3">
                        {row.fallback ? (
                          <span className="text-xs text-muted-foreground">
                            {row.fallback} ·{" "}
                            <span className="font-mono">{row.fallbackModel}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-1">
                        <Badge variant={degraded ? "destructive" : "secondary"}>
                          {row.activeProvider ?? "—"}
                        </Badge>
                        {degraded ? (
                          <span className="ml-1 text-xs text-muted-foreground">(fallback)</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {byCapability.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Per-capability spend</CardTitle>
            <CardDescription>
              Vision, Lifestyle/Shopping explanations, conversation, and structured
              playground traffic once routed through the runtime.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Capability</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Reqs</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Fallbacks</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Spend $</th>
                    <th className="py-1 font-medium tabular-nums">Savings $</th>
                  </tr>
                </thead>
                <tbody>
                  {byCapability.map((row) => (
                    <tr key={row.capability} className="border-t">
                      <td className="py-1 pr-3 capitalize">
                        {row.capability.replace(/_/g, " ")}
                      </td>
                      <td className="py-1 pr-3 tabular-nums">{row.requests}</td>
                      <td className="py-1 pr-3 tabular-nums">{row.fallbacks}</td>
                      <td className="py-1 pr-3 tabular-nums">${row.spend.toFixed(4)}</td>
                      <td className="py-1 tabular-nums">${row.savings.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Runtime metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Runtime metrics</CardTitle>
          <CardDescription>
            Per capability × provider × model × prompt version, since the last restart.{" "}
            {metrics.totalRequests} request{metrics.totalRequests === 1 ? "" : "s"} · est. $
            {metrics.totalCostUsd.toFixed(4)} · {metrics.totalFallbacks} fallback
            {metrics.totalFallbacks === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.byCapabilityProvider.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No AI calls have been routed through the runtime yet. Trigger an
              explanation, playground run, chat, or vision call.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Capability</th>
                    <th className="py-1 pr-3 font-medium">Provider</th>
                    <th className="py-1 pr-3 font-medium">Model</th>
                    <th className="py-1 pr-3 font-medium">Prompt</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Reqs</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Cache</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">FB</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Fail</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Avg ms</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Tokens</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Est $</th>
                    <th className="py-1 font-medium tabular-nums">Save $</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byCapabilityProvider.map((row) => (
                    <tr
                      key={`${row.capability}:${row.provider}:${row.model}:${row.promptVersion}`}
                      className="border-t"
                    >
                      <td className="py-1 pr-3 capitalize">
                        {row.capability.replace(/_/g, " ")}
                      </td>
                      <td className="py-1 pr-3">{row.provider}</td>
                      <td className="py-1 pr-3 font-mono text-xs">{row.model}</td>
                      <td className="py-1 pr-3 font-mono text-xs">{row.promptVersion}</td>
                      <td className="py-1 pr-3 tabular-nums">{row.requests}</td>
                      <td className="py-1 pr-3 tabular-nums">{row.cacheHits}</td>
                      <td className="py-1 pr-3 tabular-nums">{row.fallbacks}</td>
                      <td className="py-1 pr-3 tabular-nums">{row.failures}</td>
                      <td className="py-1 pr-3 tabular-nums">{row.avgLatencyMs ?? "—"}</td>
                      <td className="py-1 pr-3 tabular-nums">{row.totalTokens}</td>
                      <td className="py-1 pr-3 tabular-nums">${row.estCostUsd.toFixed(4)}</td>
                      <td className="py-1 tabular-nums">${row.cacheSavingsUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
