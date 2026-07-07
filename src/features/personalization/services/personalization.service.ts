/**
 * Personalization service (RFC-004) — orchestrates the repository + the pure
 * PersonalizationEngine, returning `{ data, error }`. It assembles signals from
 * behaviour, feeds them (plus overrides + the cold-start prior) to
 * `derivePreferenceProfile`, and returns the profile. The engine decides; this
 * layer only wires data.
 */

import { DEFAULT_PREFERENCES } from "@/domain/recommendation";
import {
  derivePreferenceProfile,
  deriveSignals,
  type PreferenceOverride,
  type PreferenceDimension,
  type PreferencePrior,
  type UserPreferenceProfile,
} from "@/domain/personalization";
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

  const profile = derivePreferenceProfile(
    {
      signals,
      overrides: data.overrides,
      protectedItemIds: data.protectedItemIds,
      avoidedItemIds: data.avoidedItemIds,
      prior: PRIOR,
    },
    { generatedAt },
  );

  const nameOf = (id: string) => ({ id, name: data.itemNames[id] ?? id });

  return {
    data: {
      profile,
      protectedItems: profile.protectedItemIds.map(nameOf),
      avoidedItems: profile.avoidedItemIds.map(nameOf),
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
