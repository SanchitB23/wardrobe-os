import type { Metadata } from "next";

import packageJson from "@/package.json";
import { getServerAIRuntime } from "@/ai/server/ai-runtime.server";
import { buildStatusModel, type ServiceId } from "@/domain/status";
import { StatusView } from "@/features/status/components/status-view";
import type { AICapability } from "@/runtime/ai";
import { logRingBuffer } from "@/runtime/logging/ring-buffer";

export const metadata: Metadata = {
  title: "Status",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function lastCallsFromLogs(): { serviceId: ServiceId; at: string; ok: boolean }[] {
  const calls: { serviceId: ServiceId; at: string; ok: boolean }[] = [];
  for (const record of logRingBuffer.recent({ limit: 200 })) {
    if (record.kind === "ai_usage") {
      const provider = record.provider === "openai" ? "openai" : "gemini";
      calls.push({
        serviceId: provider,
        at: record.timestamp,
        ok: record.level !== "error",
      });
    }
    if (record.kind === "weather_request") {
      calls.push({
        serviceId: "open_meteo",
        at: record.timestamp,
        ok: record.status === "ok" || record.cached,
      });
    }
  }
  return calls;
}

export default function StatusPage() {
  const runtime = getServerAIRuntime();
  const resolver = runtime.getPolicyResolver();

  const routes = (Object.keys(runtime.getPolicies()) as AICapability[]).map(
    (capability) => resolver.describe(capability),
  );

  const overriddenCapabilities = (
    Object.keys(runtime.getPolicies()) as AICapability[]
  ).filter((capability) =>
    Boolean(process.env[`AI_POLICY_${capability.toUpperCase()}`]),
  );

  const budget = runtime.budgetStatus();

  const model = buildStatusModel({
    routes: routes.map((route) => ({
      capability: route.capability,
      provider: route.provider,
      model: route.model,
      fallback: route.fallback,
      fallbackModel: route.fallbackModel,
    })),
    overriddenCapabilities,
    budget: {
      spentUsd: budget.spentUsd,
      softAlertUsd: budget.softAlertUsd,
      hardStopUsd: budget.hardStopUsd,
      monthlyBudgetUsd: budget.monthlyBudgetUsd,
    },
    configured: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      supabase:
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      open_meteo: true, // keyless public API
    },
    lastCalls: lastCallsFromLogs(),
  });

  return (
    <StatusView
      model={model}
      version={packageJson.version}
      environment={process.env.NODE_ENV ?? "unknown"}
    />
  );
}
