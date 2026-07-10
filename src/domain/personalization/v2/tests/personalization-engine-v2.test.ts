import { describe, expect, it } from "vitest";

import { derivePreferenceProfileV2 } from "@/domain/personalization/v2/PersonalizationEngineV2";
import { classifyLifecycle } from "@/domain/personalization/v2/PreferenceLifecycle";
import { computeTrend, seriesStability, sinceFrom } from "@/domain/personalization/v2/PreferenceStability";
import { resolveExploreExploit } from "@/domain/personalization/v2/ExploreExploit";
import type { PreferenceSignal } from "@/domain/personalization/types";

const GENERATED_AT = "2026-07-05T00:00:00.000Z";

function daysAgo(days: number): string {
  return new Date(new Date(GENERATED_AT).getTime() - days * 86400000).toISOString();
}

/** A colour `wear` signal at a given age. */
function wear(value: string, days: number): PreferenceSignal {
  return {
    type: "wear",
    facets: [{ dimension: "color", value }],
    polarity: 1,
    occurredAt: daysAgo(days),
  };
}

/** A rejected-recommendation (negative) colour signal. */
function reject(value: string, days: number): PreferenceSignal {
  return {
    type: "recommendation_rejected",
    facets: [{ dimension: "color", value }],
    polarity: -1,
    occurredAt: daysAgo(days),
  };
}

/**
 * A wardrobe history where:
 *  - navy is worn steadily across the whole window (established)
 *  - olive is worn only recently (rising)
 *  - orange was worn only long ago (fading)
 *  - chartreuse is only ever rejected (net-negative)
 */
function history(): PreferenceSignal[] {
  return [
    ...[5, 20, 45, 75, 105, 140, 170].map((d) => wear("navy", d)),
    ...[3, 12, 22].map((d) => wear("olive", d)),
    ...[150, 165, 178].map((d) => wear("orange", d)),
    ...[6, 14, 24, 33].map((d) => reject("chartreuse", d)),
  ];
}

const run = (extra?: Partial<Parameters<typeof derivePreferenceProfileV2>[0]>) =>
  derivePreferenceProfileV2(
    { signals: history(), ...extra },
    { generatedAt: GENERATED_AT, withTimeline: true },
  );

function colorPref(result: ReturnType<typeof run>, value: string) {
  return result.profile.preferredColors.find((p) => p.value === value);
}

// ---------------------------------------------------------------------------
// Pure classifier / helpers
// ---------------------------------------------------------------------------

describe("classifyLifecycle", () => {
  it("classifies a strong, stable, steady preference as core", () => {
    expect(classifyLifecycle({ weight: 0.9, stability: 0.8, trend: "steady", netNegative: false })).toBe("core");
  });
  it("classifies a rising, not-yet-stable preference as emerging", () => {
    expect(classifyLifecycle({ weight: 0.4, stability: 0.2, trend: "rising", netNegative: false })).toBe("emerging");
  });
  it("classifies a falling, weakened preference as declining", () => {
    expect(classifyLifecycle({ weight: 0.35, stability: 0.5, trend: "falling", netNegative: false })).toBe("declining");
  });
  it("classifies a net-negative value as avoided", () => {
    expect(classifyLifecycle({ weight: 0, stability: 0, trend: "steady", netNegative: true })).toBe("avoided");
  });
});

describe("stability helpers", () => {
  it("computeTrend detects rising / falling / steady", () => {
    expect(computeTrend([0, 0, 0.5, 0.9])).toBe("rising");
    expect(computeTrend([0.9, 0.8, 0.2, 0])).toBe("falling");
    expect(computeTrend([0.5, 0.5, 0.5, 0.5])).toBe("steady");
  });
  it("seriesStability rewards spread + persistence", () => {
    expect(seriesStability([0.8, 0.8, 0.8, 0.8])).toBeGreaterThan(seriesStability([0, 0, 0, 0.9]));
  });
  it("sinceFrom returns the earliest sustained-dominant window", () => {
    const points = [
      { at: daysAgo(150), weight: 0.2 },
      { at: daysAgo(90), weight: 0.6 },
      { at: daysAgo(30), weight: 0.7 },
      { at: daysAgo(0), weight: 0.8 },
    ];
    expect(sinceFrom(points)).toBe(daysAgo(90).slice(0, 10));
  });
});

describe("resolveExploreExploit", () => {
  it("returns distinct, ordered weights per mode", () => {
    const exploit = resolveExploreExploit("exploit");
    const balanced = resolveExploreExploit("balanced");
    const explore = resolveExploreExploit("explore");
    expect(exploit.preferenceFit).toBeGreaterThan(balanced.preferenceFit);
    expect(explore.preferenceFit).toBeLessThan(balanced.preferenceFit);
    expect(explore.wardrobeHealthContribution).toBeGreaterThan(exploit.wardrobeHealthContribution);
    expect(balanced).toEqual({ preferenceFit: 1, wardrobeHealthContribution: 1, diversityBias: 0 });
  });
});

// ---------------------------------------------------------------------------
// Engine — lifecycle over real windowed derivation
// ---------------------------------------------------------------------------

describe("derivePreferenceProfileV2 — lifecycle", () => {
  it("classifies a steadily-worn colour as core", () => {
    expect(colorPref(run(), "navy")?.lifecycle).toBe("core");
  });
  it("classifies a recently-adopted colour as emerging", () => {
    expect(colorPref(run(), "olive")?.lifecycle).toBe("emerging");
  });
  it("classifies a faded colour as declining", () => {
    expect(colorPref(run(), "orange")?.lifecycle).toBe("declining");
  });
  it("surfaces a net-negative colour as an avoided preference (not in the profile)", () => {
    const result = run();
    expect(colorPref(result, "chartreuse")).toBeUndefined();
    expect(result.avoidedPreferences).toContainEqual({ dimension: "color", value: "chartreuse" });
  });
});

describe("derivePreferenceProfileV2 — timeline + evolution", () => {
  it("builds a timeline with points and a trend for a preference", () => {
    const result = run();
    const navy = result.timelines.find((t) => t.value === "navy");
    expect(navy).toBeDefined();
    expect(navy!.points.length).toBe(6); // DEFAULT_WINDOW.count
    expect(["rising", "steady", "falling"]).toContain(navy!.trend);
  });
  it("records evolution when a preference newly emerges in the latest window", () => {
    const result = run();
    const olive = result.evolution.find((e) => e.value === "olive");
    expect(olive).toBeDefined();
    expect(olive!.changes[0].before).toBeNull();
    expect(olive!.changes[0].after).toBeGreaterThan(0);
    expect(olive!.changes[0].timestamp).toBe(GENERATED_AT);
  });
});

describe("derivePreferenceProfileV2 — overrides + determinism", () => {
  it("keeps a pinned override winning (source override, stability preserved)", () => {
    const result = run({
      overrides: [{ dimension: "color", value: "grey", mode: "pin" }],
    });
    const grey = colorPref(result, "grey");
    expect(grey).toBeDefined();
    expect(grey!.source).toBe("override");
    expect(grey!.stability).toBe(1); // not clobbered by timeline recompute
  });
  it("is deterministic for the same signals + generatedAt + window", () => {
    expect(run()).toEqual(run());
  });
});
