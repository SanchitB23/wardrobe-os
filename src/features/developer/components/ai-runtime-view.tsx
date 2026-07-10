import { NetworkIcon } from "lucide-react";

import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AIRuntimeMetricsSnapshot, AIRuntimePolicies, AICapability } from "@/runtime/ai";

/** Presentational (server-rendered) AI Runtime v2 developer view (RFC-014). */
export function AIRuntimeView({
  policies,
  metrics,
  providers,
}: {
  policies: AIRuntimePolicies;
  metrics: AIRuntimeMetricsSnapshot;
  providers: string[];
}) {
  const capabilities = Object.keys(policies) as AICapability[];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="AI Runtime"
        badge={<Badge variant="secondary">Dev</Badge>}
        description="Capability-centric AI routing (RFC-014). Capabilities choose providers via declarative policies; the runtime routes, benchmarks, versions prompts, and measures. It never decides."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <NetworkIcon className="size-4" /> Provider policies
          </CardTitle>
          <CardDescription>
            Registered providers: {providers.join(", ") || "—"}. Override per capability with
            <code className="mx-1 rounded bg-muted px-1 text-xs">AI_POLICY_&lt;CAP&gt;=primary,fallback</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {capabilities.map((capability) => (
            <div key={capability} className="flex items-center justify-between gap-2 text-sm">
              <span className="capitalize text-muted-foreground">{capability.replace(/_/g, " ")}</span>
              <span className="flex items-center gap-1.5">
                <Badge variant="outline">{policies[capability].primary}</Badge>
                {policies[capability].fallback ? (
                  <>
                    <span className="text-xs text-muted-foreground">→</span>
                    <Badge variant="secondary">{policies[capability].fallback}</Badge>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">(no fallback)</span>
                )}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Runtime metrics</CardTitle>
          <CardDescription>
            Per capability × provider × prompt version, since the last restart.
            {" "}
            {metrics.totalRequests} request{metrics.totalRequests === 1 ? "" : "s"} · est.
            ${metrics.totalCostUsd.toFixed(4)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.byCapabilityProvider.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No AI calls have been routed through the runtime yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Capability</th>
                    <th className="py-1 pr-3 font-medium">Provider</th>
                    <th className="py-1 pr-3 font-medium">Prompt</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Reqs</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Cache</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Fail</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Avg ms</th>
                    <th className="py-1 pr-3 font-medium tabular-nums">Tokens</th>
                    <th className="py-1 font-medium tabular-nums">Est $</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byCapabilityProvider.map((row) => (
                    <tr key={`${row.capability}:${row.provider}:${row.promptVersion}`} className="border-t">
                      <td className="py-1 pr-3 capitalize">{row.capability.replace(/_/g, " ")}</td>
                      <td className="py-1 pr-3">{row.provider}</td>
                      <td className="py-1 pr-3 font-mono text-xs">{row.promptVersion}</td>
                      <td className="py-1 pr-3 tabular-nums">{row.requests}</td>
                      <td className="py-1 pr-3 tabular-nums">{row.cacheHits}</td>
                      <td className="py-1 pr-3 tabular-nums">{row.failures}</td>
                      <td className="py-1 pr-3 tabular-nums">{row.avgLatencyMs ?? "—"}</td>
                      <td className="py-1 pr-3 tabular-nums">{row.totalTokens}</td>
                      <td className="py-1 tabular-nums">${row.estCostUsd.toFixed(4)}</td>
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
