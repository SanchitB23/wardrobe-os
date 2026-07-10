/**
 * AI Runtime v2 (RFC-014) — capability routing.
 *
 * Pure: resolves a capability to its provider policy, and maps a semantic
 * capability to the mechanical provider method (generate / vision). No I/O.
 */

import { AIError } from "@/ai/types";
import type {
  AICapability,
  AIRuntimePolicies,
  MechanicalCapability,
  ProviderPolicy,
} from "@/runtime/ai/types";

/** Which provider method a capability calls. Vision → vision(); everything else
 *  (text explanation/summarization/conversation, image-gen prompt, embeddings)
 *  routes through generate(). */
export function mechanicalFor(capability: AICapability): MechanicalCapability {
  return capability === "vision" ? "vision" : "generate";
}

/** Resolve the provider policy for a capability. Throws if none is configured. */
export function resolveProvider(
  capability: AICapability,
  policies: AIRuntimePolicies,
): ProviderPolicy {
  const policy = policies[capability];
  if (!policy || !policy.primary) {
    throw new AIError("no_provider", `No provider policy for capability "${capability}".`);
  }
  return policy;
}
