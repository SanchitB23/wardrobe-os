import type { Metadata } from "next";

import { ExecutionGraphView } from "@/features/developer/components/execution-graph-view";
import {
  DEFAULT_CAPABILITY_REGISTRY,
  buildDependencyGraph,
  resolveExecutionOrder,
  type CapabilityId,
} from "@/domain/orchestrator";
import { logRingBuffer } from "@/runtime/logging/ring-buffer";

export const metadata: Metadata = {
  title: "Execution Graph",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ExecutionGraphPage() {
  const ids = Object.keys(DEFAULT_CAPABILITY_REGISTRY) as CapabilityId[];
  const nodes = ids.map((id) => ({
    id,
    dependsOn: [...(DEFAULT_CAPABILITY_REGISTRY[id]?.dependsOn ?? [])],
  }));
  const edges = nodes.flatMap((n) =>
    n.dependsOn.map((from) => ({ from, to: n.id })),
  );
  const graph = buildDependencyGraph(ids, DEFAULT_CAPABILITY_REGISTRY);
  const order = resolveExecutionOrder(graph);
  const traces = logRingBuffer.recent({ limit: 100 });

  return (
    <ExecutionGraphView nodes={nodes} edges={edges} order={order} traces={traces} />
  );
}
