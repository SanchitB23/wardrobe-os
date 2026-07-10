/**
 * Personalization service (RFC-004) — orchestrates the repository + the pure
 * PersonalizationEngine, returning `{ data, error }`. It assembles signals from
 * behaviour, feeds them (plus overrides + the cold-start prior) to
 * `derivePreferenceProfile`, and returns the profile. The engine decides; this
 * layer only wires data.
 */

import { DEFAULT_PREFERENCES } from "@/domain/recommendation";
import {
  deriveSignals,
  type PreferenceOverride,
  type PreferenceDimension,
  type PreferencePrior,
  type UserPreferenceProfile,
} from "@/domain/personalization";
import {
  derivePreferenceProfileV2,
  type PreferenceEvolution,
  type PreferenceTimeline,
} from "@/domain/personalization/v2";
import {
  deletePreferenceOverride,
  selectPersonalizationData,
  setItemPersonalizationFlags,
  upsertPreferenceOverride,
} from "@/features/personalization/repositories/personalization.repository";

export interface PreferenceProfileResult {
  profile: UserPreferenceProfile;
  protectedItems: { id: string; name: string }[];
  avoidedItems: { id: string; name: string }[];
  /** RFC-013: per-preference timelines for the top preferences. */
  timelines: PreferenceTimeline[];
  /** RFC-013: what changed since the previous window. */
  evolution: PreferenceEvolution[];
  /** RFC-013: net-negative preference values (lifecycle "avoided"). */
  avoidedPreferences: { dimension: string; value: string }[];
}

/** Today's static defaults become the cold-start prior. */
const PRIOR: PreferencePrior = {
  preferredStyles: DEFAULT_PREFERENCES.preferredStyles,
  preferredFormality: DEFAULT_PREFERENCES.preferredFormality,
  avoidedColors: DEFAULT_PREFERENCES.avoidedColors,
};

export async function getPreferenceProfile(
  options: { generatedAt?: string } = {},
): Promise<{ data: PreferenceProfileResult | null; error: Error | null }> {
  const { data, error } = await selectPersonalizationData();
  if (error) return { data: null, error };
  if (!data) return { data: null, error: new Error("Personalization data unavailable.") };

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const signals = deriveSignals(data.source, generatedAt);

  // RFC-013: v2 derivation — lifecycle + since + timelines + evolution.
  const { profile, timelines, evolution, avoidedPreferences } = derivePreferenceProfileV2(
    {
      signals,
      overrides: data.overrides,
      protectedItemIds: data.protectedItemIds,
      avoidedItemIds: data.avoidedItemIds,
      prior: PRIOR,
    },
    { generatedAt, withTimeline: true },
  );

  const nameOf = (id: string) => ({ id, name: data.itemNames[id] ?? id });

  return {
    data: {
      profile,
      protectedItems: profile.protectedItemIds.map(nameOf),
      avoidedItems: profile.avoidedItemIds.map(nameOf),
      timelines,
      evolution,
      avoidedPreferences,
    },
    error: null,
  };
}

export async function savePreferenceOverride(
  override: PreferenceOverride,
): Promise<{ data: true | null; error: Error | null }> {
  const { error } = await upsertPreferenceOverride(override);
  return error ? { data: null, error } : { data: true, error: null };
}

export async function clearPreferenceOverride(
  dimension: PreferenceDimension,
  value: string,
): Promise<{ data: true | null; error: Error | null }> {
  const { error } = await deletePreferenceOverride(dimension, value);
  return error ? { data: null, error } : { data: true, error: null };
}

export async function setItemFlags(
  itemId: string,
  flags: { protected?: boolean; avoided?: boolean },
): Promise<{ data: true | null; error: Error | null }> {
  const { error } = await setItemPersonalizationFlags(itemId, flags);
  return error ? { data: null, error } : { data: true, error: null };
}
