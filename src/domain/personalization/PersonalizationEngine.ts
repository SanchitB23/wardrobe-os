/**
 * Personalization Engine (RFC-004) — deterministic user-preference learning.
 *
 * Pure TypeScript: no React, no Supabase, no AI, no ML, no I/O. Given the user's
 * behavioural signals (+ optional overrides and a cold-start prior), it derives
 * a {@link UserPreferenceProfile} with per-preference confidence and stability.
 * Identical inputs (+ injected `generatedAt`) always produce identical output.
 *
 * Preferences are RECALCULATED from the full signal history each run — never
 * incrementally mutated. Behaviour is the single source of truth; AI only ever
 * CONSUMES the resulting profile, it never derives or edits it (ADR-005).
 */

import { PERSONALIZATION_ENGINE_VERSION } from "@/domain/personalization/constants";
import { applyOverridesForDimension } from "@/domain/personalization/PreferenceOverrides";
import { assembleProfile } from "@/domain/personalization/PreferenceProfile";
import { aggregateSignals } from "@/domain/personalization/PreferenceScoring";
import type {
  DerivedPreference,
  PersonalizationInput,
  PersonalizationOptions,
  PreferenceDimension,
  UserPreferenceProfile,
} from "@/domain/personalization/types";

export function derivePreferenceProfile(
  input: PersonalizationInput,
  options: PersonalizationOptions = {},
): UserPreferenceProfile {
  const now = options.generatedAt ?? new Date().toISOString();
  const overrides = input.overrides ?? [];

  const byDimension = aggregateSignals(input.signals, now);

  const overridesFor = (dimension: PreferenceDimension, derived: DerivedPreference[]) =>
    applyOverridesForDimension(dimension, derived, overrides);

  return assembleProfile({
    byDimension,
    overridesFor,
    protectedItemIds: input.protectedItemIds ?? [],
    avoidedItemIds: input.avoidedItemIds ?? [],
    signalCount: input.signals.length,
    overrideCount: overrides.length,
    prior: input.prior,
    now,
    engineVersion: PERSONALIZATION_ENGINE_VERSION,
  });
}
