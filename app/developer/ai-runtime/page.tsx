import type { Metadata } from "next";

import { AIRuntimeView } from "@/features/developer/components/ai-runtime-view";
import { getServerAIRuntime } from "@/ai/server/ai-runtime.server";
import type { AICapability, RouteDescription } from "@/runtime/ai";

export const metadata: Metadata = {
  title: "AI Runtime",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AIRuntimePage() {
  const runtime = getServerAIRuntime();
  const resolver = runtime.getPolicyResolver();
  const providers = ["gemini", "openai", "claude"];

  // Resolve capability → provider → model (+ fallback + active provider) via the
  // RuntimePolicyResolver (RFC-014B) — the single decision place.
  const routes: RouteDescription[] = (Object.keys(runtime.getPolicies()) as AICapability[]).map(
    (capability) => resolver.describe(capability),
  );

  return (
    <AIRuntimeView
      routes={routes}
      metrics={runtime.metricsSnapshot()}
      providers={providers}
      budget={runtime.budgetStatus()}
    />
  );
}
