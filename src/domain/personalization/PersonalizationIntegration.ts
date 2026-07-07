/**
 * Integration mapping (RFC-004): turn a derived {@link UserPreferenceProfile}
 * into the {@link PreferenceSnapshot} shape that `RecommendationContext.preferences`
 * expects, superseding the static `DEFAULT_PREFERENCES`. Pure — the profile is
 * the source of truth; this only reshapes it for existing engines.
 *
 * This is the seam RFC-004 defines: a caller assembling a RecommendationContext
 * passes `toPreferenceSnapshot(profile)` to the builder so learned preferences
 * flow into scoring wherever `context.preferences` is consumed. Dimensions the
 * engine does not derive (lifestyle, climate, budget) fall through from `base`.
 */

import { DEFAULT_PREFERENCES, type PreferenceSnapshot } from "@/domain/recommendation";
import type { UserPreferenceProfile } from "@/domain/personalization/types";
import type { FormalityEnum } from "@/types/wardrobe";

const FORMALITY_VALUES: ReadonlySet<string> = new Set<FormalityEnum>([
  "casual",
  "smart_casual",
  "business_casual",
  "business_formal",
  "formal",
]);

export function toPreferenceSnapshot(
  profile: UserPreferenceProfile,
  base: PreferenceSnapshot = DEFAULT_PREFERENCES,
): PreferenceSnapshot {
  const styles = profile.preferredStyles.map((p) => p.value);
  const formality = profile.preferredFormality
    .map((p) => p.value)
    .filter((v): v is FormalityEnum => FORMALITY_VALUES.has(v));

  return {
    ...base,
    // Learned preferences supersede the static defaults when present.
    preferredStyles: styles.length > 0 ? styles : base.preferredStyles,
    preferredFormality: formality.length > 0 ? formality : base.preferredFormality,
    avoidedColors: base.avoidedColors,
  };
}
