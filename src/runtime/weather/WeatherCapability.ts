/**
 * Weather orchestrator capability (RFC-011). The definition lives in the domain
 * orchestrator registry (it is pure — it only reads `ctx.shared.recommendation.weather`);
 * re-exported here so the Weather Runtime's public surface documents it.
 */

export { weatherCapability } from "@/domain/orchestrator/CapabilityRegistry";

export const WEATHER_CAPABILITY_ID = "weather" as const;
