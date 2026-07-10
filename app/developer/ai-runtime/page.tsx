import type { Metadata } from "next";

import { AIRuntimeView } from "@/features/developer/components/ai-runtime-view";
import { getServerAIRuntime } from "@/ai/server/ai-runtime.server";

export const metadata: Metadata = {
  title: "AI Runtime",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AIRuntimePage() {
  const runtime = getServerAIRuntime();
  const policies = runtime.getPolicies();
  const providers = ["gemini", "openai", "claude"];

  return (
    <AIRuntimeView
      policies={policies}
      metrics={runtime.metricsSnapshot()}
      providers={providers}
    />
  );
}
