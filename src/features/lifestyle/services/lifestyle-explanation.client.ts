/**
 * Client helper for the Lifestyle Plan explanation (RFC-006). Builds the curated
 * input from the plan (only deterministic outputs leave the client) and calls
 * the server route. Returns the validated explanation + a cache-hit flag.
 */

import {
  toLifestyleExplanationInput,
  type LifestylePlanExplanation,
} from "@/ai/schemas/LifestylePlanExplanation.schema";
import type { LifestylePlan } from "@/domain/lifestyle";

export interface LifestyleExplanationClientResult {
  explanation: LifestylePlanExplanation;
  cached: boolean;
}

export async function explainLifestylePlan(
  plan: LifestylePlan,
): Promise<LifestyleExplanationClientResult> {
  const input = toLifestyleExplanationInput(plan);
  const response = await fetch("/api/ai/explain-lifestyle-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: LifestylePlanExplanation; cached?: boolean }
    | { ok: false; error?: string }
    | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error((payload && "error" in payload && payload.error) || "Couldn't explain the plan.");
  }
  return { explanation: payload.data, cached: Boolean(payload.cached) };
}
