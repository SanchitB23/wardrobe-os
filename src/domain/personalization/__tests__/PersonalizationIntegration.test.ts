import { describe, expect, it } from "vitest";

import { derivePreferenceProfile } from "@/domain/personalization/PersonalizationEngine";
import { toPreferenceSnapshot } from "@/domain/personalization/PersonalizationIntegration";
import { DEFAULT_PREFERENCES } from "@/domain/recommendation";
import type { PreferenceSignal } from "@/domain/personalization/types";

const AT = "2026-07-07T00:00:00.000Z";

function wear(dimension: "style" | "formality", value: string): PreferenceSignal {
  return { type: "wear", facets: [{ dimension, value }], polarity: 1, occurredAt: AT };
}

describe("toPreferenceSnapshot", () => {
  it("maps learned styles/formality onto the PreferenceSnapshot, superseding defaults", () => {
    const profile = derivePreferenceProfile(
      {
        signals: [
          wear("style", "Minimal"),
          wear("style", "Minimal"),
          wear("formality", "smart_casual"),
        ],
      },
      { generatedAt: AT },
    );
    const snapshot = toPreferenceSnapshot(profile);
    expect(snapshot.preferredStyles).toContain("Minimal");
    expect(snapshot.preferredFormality).toContain("smart_casual");
    // Non-derived fields fall through from the base defaults.
    expect(snapshot.lifestyle).toBe(DEFAULT_PREFERENCES.lifestyle);
    expect(snapshot.climate).toBe(DEFAULT_PREFERENCES.climate);
  });

  it("falls back to the default snapshot when nothing is derived", () => {
    const profile = derivePreferenceProfile({ signals: [] }, { generatedAt: AT });
    const snapshot = toPreferenceSnapshot(profile);
    expect(snapshot.preferredStyles).toEqual(DEFAULT_PREFERENCES.preferredStyles);
    expect(snapshot.preferredFormality).toEqual(DEFAULT_PREFERENCES.preferredFormality);
  });

  it("drops non-enum formality values from the mapping", () => {
    const profile = derivePreferenceProfile(
      { signals: [wear("formality", "not_a_formality"), wear("formality", "not_a_formality")] },
      { generatedAt: AT },
    );
    const snapshot = toPreferenceSnapshot(profile);
    expect(snapshot.preferredFormality).not.toContain("not_a_formality");
  });
});
