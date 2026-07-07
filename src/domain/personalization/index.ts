/**
 * Personalization domain (RFC-004) — deterministic user-preference learning.
 * The engine derives; AI only consumes the profile.
 */

export { derivePreferenceProfile } from "@/domain/personalization/PersonalizationEngine";
export { toPreferenceSnapshot } from "@/domain/personalization/PersonalizationIntegration";
export {
  deriveSignals,
  itemFacets,
  type ItemFacetSource,
  type WearEventSource,
  type SavedOutfitSource,
  type PurchaseSource,
  type PersonalizationSourceData,
} from "@/domain/personalization/PreferenceSignalNormalizer";
export {
  PERSONALIZATION_ENGINE_VERSION,
  SIGNAL_WEIGHTS,
  HALF_LIFE_DAYS,
  MIN_EVIDENCE,
} from "@/domain/personalization/constants";
export type {
  PreferenceDimension,
  PreferenceSignalType,
  PreferenceSignal,
  OverrideMode,
  PreferenceOverride,
  PreferenceLifecycle,
  PreferenceSource,
  DerivedPreference,
  UserPreferenceProfile,
  PreferencePrior,
  PersonalizationInput,
  PersonalizationOptions,
  PreferenceTimeline,
  PreferenceEvolution,
} from "@/domain/personalization/types";
