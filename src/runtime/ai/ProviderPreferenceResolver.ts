/**
 * ProviderPreferenceResolver (RFC-014B) — turns a provider policy into an ordered
 * preference list (primary → fallback), annotated with current availability.
 *
 * Pure. It expresses *who would serve, in what order* — the declarative view the
 * dashboard renders and the router executes. Availability (e.g. OpenAI budget
 * hard stop) is injected, never computed here.
 */

import type { AIProviderId } from "@/ai/types";
import type { ProviderPolicy } from "@/runtime/ai/types";

export interface ProviderPreference {
  id: AIProviderId;
  isFallback: boolean;
  available: boolean;
}

export interface PreferenceOptions {
  /** Availability predicate (defaults to "everything available"). */
  isAvailable?: (id: AIProviderId) => boolean;
}

/** Ordered [primary, fallback?] with availability flags. */
export function resolveProviderPreference(
  policy: ProviderPolicy,
  opts: PreferenceOptions = {},
): ProviderPreference[] {
  const isAvailable = opts.isAvailable ?? (() => true);
  const list: ProviderPreference[] = [
    { id: policy.primary, isFallback: false, available: isAvailable(policy.primary) },
  ];
  if (policy.fallback && policy.fallback !== policy.primary) {
    list.push({ id: policy.fallback, isFallback: true, available: isAvailable(policy.fallback) });
  }
  return list;
}

/** The provider that would actually serve: the first available in preference order. */
export function activeProvider(
  policy: ProviderPolicy,
  opts: PreferenceOptions = {},
): AIProviderId | null {
  return resolveProviderPreference(policy, opts).find((p) => p.available)?.id ?? null;
}
