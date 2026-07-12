/**
 * Pure status display model (RFC-028). All I/O happens in the /status server
 * page; this module only shapes the inputs deterministically.
 */

export type ServiceId = "gemini" | "openai" | "supabase" | "open_meteo";
export type ServiceState = "ok" | "warn" | "error" | "unknown";

export const SERVICE_ORDER: ServiceId[] = [
  "gemini",
  "openai",
  "supabase",
  "open_meteo",
];

export type StatusModelInput = {
  routes: {
    capability: string;
    provider: string;
    model: string;
    fallback: string | null;
    fallbackModel: string | null;
  }[];
  overriddenCapabilities: string[];
  budget: {
    spentUsd: number;
    softAlertUsd: number;
    hardStopUsd: number;
    monthlyBudgetUsd: number;
  };
  configured: Record<ServiceId, boolean>;
  lastCalls: { serviceId: ServiceId; at: string; ok: boolean }[];
};

export type StatusModel = {
  aiWiring: {
    capability: string;
    primary: string;
    model: string;
    fallback: string | null;
    override: boolean;
  }[];
  services: {
    id: ServiceId;
    configured: boolean;
    lastCall: { at: string; ok: boolean } | null;
    state: ServiceState;
  }[];
  budget: StatusModelInput["budget"] & {
    state: "ok" | "soft_alert" | "hard_stop";
  };
};

function newestCall(
  lastCalls: StatusModelInput["lastCalls"],
  serviceId: ServiceId,
): { at: string; ok: boolean } | null {
  const calls = lastCalls
    .filter((call) => call.serviceId === serviceId)
    .sort((a, b) => b.at.localeCompare(a.at));
  return calls[0] ? { at: calls[0].at, ok: calls[0].ok } : null;
}

export function buildStatusModel(input: StatusModelInput): StatusModel {
  const overridden = new Set(input.overriddenCapabilities);

  const aiWiring = [...input.routes]
    .sort((a, b) => a.capability.localeCompare(b.capability))
    .map((route) => ({
      capability: route.capability,
      primary: route.provider,
      model: route.model,
      fallback: route.fallback,
      override: overridden.has(route.capability),
    }));

  const services = SERVICE_ORDER.map((id) => {
    const configured = input.configured[id];
    const lastCall = newestCall(input.lastCalls, id);
    const state: ServiceState = !configured
      ? "error"
      : lastCall === null
        ? "unknown"
        : lastCall.ok
          ? "ok"
          : "warn";
    return { id, configured, lastCall, state };
  });

  const budgetState =
    input.budget.spentUsd >= input.budget.hardStopUsd
      ? "hard_stop"
      : input.budget.spentUsd >= input.budget.softAlertUsd
        ? "soft_alert"
        : "ok";

  return {
    aiWiring,
    services,
    budget: { ...input.budget, state: budgetState },
  };
}
