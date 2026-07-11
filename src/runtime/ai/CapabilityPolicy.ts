/**
 * CapabilityPolicy (RFC-014B) — the capability → provider-policy layer.
 *
 * The semantic home for "which provider(s) serve a capability": the declarative
 * policy maps (cost-first `DEFAULT_POLICIES`, `GEMINI_ONLY_POLICIES`), env
 * overrides (`loadPolicies`), and resolution to a `{ primary, fallback }` policy.
 * It composes the existing `ProviderPolicy` + `CapabilityRouter` pieces so there
 * is one place to reason about capability routing. Pure.
 */

import { mechanicalFor, resolveProvider } from "@/runtime/ai/CapabilityRouter";
import {
  DEFAULT_POLICIES,
  GEMINI_ONLY_POLICIES,
  isKnownProvider,
  loadPolicies,
} from "@/runtime/ai/ProviderPolicy";
import type {
  AICapability,
  AIRuntimePolicies,
  MechanicalCapability,
  ProviderPolicy,
} from "@/runtime/ai/types";

/** Resolve the provider policy (primary + optional fallback) for a capability. */
export function resolveCapabilityPolicy(
  capability: AICapability,
  policies: AIRuntimePolicies,
): ProviderPolicy {
  return resolveProvider(capability, policies);
}

/** The mechanical provider method a capability maps to (generate | vision). */
export function mechanicalForCapability(capability: AICapability): MechanicalCapability {
  return mechanicalFor(capability);
}

export { DEFAULT_POLICIES, GEMINI_ONLY_POLICIES, loadPolicies, isKnownProvider };
