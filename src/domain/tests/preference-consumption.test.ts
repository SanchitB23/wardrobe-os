import { describe, expect, it } from "vitest";

import { buildRecommendationContext } from "@/domain/recommendation/RecommendationContextBuilder";
import type { WardrobeItemInput } from "@/domain/recommendation/RecommendationContextBuilder";
import { recommendUnifiedOutfits } from "@/domain/recommendation/UnifiedOutfitRecommendationEngine";
import { evaluateBuyVsSkip } from "@/domain/acquisition";
import type { ProspectiveItem } from "@/domain/acquisition";
import type { StyleDNAItem } from "@/domain/style-dna";

const AT = "2026-07-07T00:00:00.000Z";

function item(overrides: Partial<WardrobeItemInput>): WardrobeItemInput {
  return {
    id: overrides.id ?? "x",
    name: overrides.name ?? "Item",
    category: "Top",
    color: "Navy",
    formality: "smart_casual",
    usage: "regular",
    rating: 8,
    seasons: ["Year Round", "Summer"],
    styles: ["Minimal"],
    tags: [],
    ...overrides,
  };
}

function outfitContext(usePreferredStyle: boolean) {
  return buildRecommendationContext(
    {
      health: { overallScore: 80 } as never,
      wardrobeItems: [
        item({ id: "t1", name: "Top", category: "T-Shirt" }),
        item({ id: "b1", name: "Chinos", category: "Trousers" }),
        item({ id: "f1", name: "Sneakers", category: "Sneakers" }),
      ],
      preferences: usePreferredStyle ? { preferredStyles: ["Minimal"] } : { preferredStyles: [] },
    },
    { generatedAt: AT },
  );
}

describe("RFC-004 — outfit recommendation preference consumption (opt-in)", () => {
  it("is inert unless usePreferences is set (no regression by default)", () => {
    const context = outfitContext(true);
    const off = recommendUnifiedOutfits(context, { limit: 5 });
    // Default path produces no preference boosts.
    expect(off.every((r) => !(r.debug?.boosts ?? []).includes("Matches your preferences"))).toBe(
      true,
    );
  });

  it("rewards preference-aligned outfits when opted in (score never decreases)", () => {
    const context = outfitContext(true);
    const off = recommendUnifiedOutfits(context, { limit: 5 });
    const on = recommendUnifiedOutfits(context, { limit: 5, usePreferences: true });
    expect(on.length).toBeGreaterThan(0);
    // Bonus is non-negative, so the top score can only stay or rise.
    expect(on[0].score).toBeGreaterThanOrEqual(off[0].score);
    // At least one recommendation is flagged as preference-aligned.
    expect(on.some((r) => (r.debug?.boosts ?? []).includes("Matches your preferences"))).toBe(true);
  });
});

describe("RFC-004 — Buy vs Skip preference hints (additive)", () => {
  const prospective: ProspectiveItem = {
    name: "Minimal Navy Tee",
    category: "T-Shirt",
    styleTags: ["Minimal"],
    formality: "smart_casual",
  };
  const wardrobe: StyleDNAItem[] = [
    { id: "w1", name: "Chinos", category: "Trousers", color: "Beige", formality: "smart_casual" },
  ];

  it("raises preferenceFit (and its confidence) when learned hints align", () => {
    const withoutHints = evaluateBuyVsSkip({ item: prospective, wardrobe }, { generatedAt: AT });
    const withHints = evaluateBuyVsSkip(
      {
        item: prospective,
        wardrobe,
        preferences: { preferredStyles: ["Minimal"], preferredFormality: ["smart_casual"] },
      },
      { generatedAt: AT },
    );
    expect(withHints.scoreBreakdown.preferenceFit.score).toBeGreaterThan(
      withoutHints.scoreBreakdown.preferenceFit.score,
    );
    expect(withHints.scoreBreakdown.preferenceFit.confidence).toBeGreaterThan(
      withoutHints.scoreBreakdown.preferenceFit.confidence,
    );
  });

  it("leaves the verdict deterministic and unchanged when no hints are given", () => {
    const a = evaluateBuyVsSkip({ item: prospective, wardrobe }, { generatedAt: AT });
    const b = evaluateBuyVsSkip({ item: prospective, wardrobe }, { generatedAt: AT });
    expect(a).toEqual(b);
  });
});
