/**
 * Execution Graph developer view — static capability DAG + recent engine_trace.
 */

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
import type { CapabilityId } from "@/domain/orchestrator";
import type { StructuredLogRecord } from "@/runtime/logging/log-types";

export function ExecutionGraphView({
  nodes,
  edges,
  order,
  traces,
}: {
  nodes: Array<{ id: CapabilityId; dependsOn: CapabilityId[] }>;
  edges: Array<{ from: CapabilityId; to: CapabilityId }>;
  order: CapabilityId[];
  traces: StructuredLogRecord[];
}) {
  const engineTraces = traces.filter((t) => t.kind === "engine_trace");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Execution Graph"
        badge={<Badge variant="secondary">Dev</Badge>}
        description="Intelligence Orchestrator capability DAG (RFC-005). Static registry graph plus recent engine_trace lines when LOG_ENGINE_TRACES is on."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <NetworkIcon className="size-4" /> Capability dependency graph
          </CardTitle>
          <CardDescription>
            {nodes.length} nodes · {edges.length} edges · topological sample order shown below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="flex flex-wrap gap-2">
            {order.map((id, i) => (
              <li key={id} className="flex items-center gap-2 text-sm">
                {i > 0 ? <span className="text-muted-foreground">→</span> : null}
                <Badge variant="outline">{id}</Badge>
              </li>
            ))}
          </ol>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Capability</th>
                  <th className="py-1 font-medium">Depends on</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr key={n.id} className="border-t">
                    <td className="py-1 pr-3 font-mono text-xs">{n.id}</td>
                    <td className="py-1 text-muted-foreground">
                      {n.dependsOn.length === 0 ? "—" : n.dependsOn.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent engine traces</CardTitle>
          <CardDescription>
            From the process ring buffer. Enable with{" "}
            <code className="rounded bg-muted px-1 text-xs">LOG_ENGINE_TRACES=true</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {engineTraces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No engine_trace lines in the buffer.</p>
          ) : (
            <ul className="space-y-2">
              {engineTraces.slice(0, 20).map((t, i) =>
                t.kind === "engine_trace" ? (
                  <li key={`${t.timestamp}-${i}`} className="rounded-md border px-3 py-2 text-xs">
                    <div className="flex flex-wrap gap-2 text-muted-foreground">
                      <span>{t.timestamp}</span>
                      <Badge variant="outline">{t.status}</Badge>
                      {t.requestId ? (
                        <span className="font-mono">id:{t.requestId.slice(0, 8)}…</span>
                      ) : null}
                    </div>
                    <p className="mt-1">
                      {t.capability} · executed [{t.executedCapabilities.join(", ")}] ·{" "}
                      {t.totalLatencyMs ?? "—"}ms
                    </p>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
