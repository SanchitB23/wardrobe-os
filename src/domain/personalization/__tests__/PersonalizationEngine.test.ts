import { describe, expect, it } from "vitest";

import { derivePreferenceProfile } from "@/domain/personalization/PersonalizationEngine";
import { deriveSignals, itemFacets } from "@/domain/personalization/PreferenceSignalNormalizer";
import type {
  PreferenceDimension,
  PreferenceSignal,
  PreferenceSignalType,
} from "@/domain/personalization/types";

const AT = "2026-07-07T00:00:00.000Z";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBefore(n: number): string {
  return new Date(Date.parse(AT) - n * MS_PER_DAY).toISOString();
}

function signal(
  type: PreferenceSignalType,
  facets: { dimension: PreferenceDimension; value: string }[],
  occurredAt = AT,
  polarity: 1 | -1 = 1,
): PreferenceSignal {
  return { type, facets, polarity, occurredAt };
}

function color(value: string, occurredAt = AT, type: PreferenceSignalType = "wear"): PreferenceSignal {
  return signal(type, [{ dimension: "color", value }], occurredAt, type === "recommendation_rejected" ? -1 : 1);
}

function find(list: { value: string }[], value: string) {
  return list.find((p) => p.value === value);
}

describe("derivePreferenceProfile — aggregation & weighting", () => {
  it("derives a ranked preference from repeated wears", () => {
    const profile = derivePreferenceProfile(
      { signals: [color("navy"), color("navy"), color("navy"), color("grey")] },
      { generatedAt: AT },
    );
    const navy = find(profile.preferredColors, "navy");
    const grey = find(profile.preferredColors, "grey");
    expect(navy).toBeTruthy();
    expect(navy!.weight).toBe(1); // strongest in dimension → normalized to 1
    expect(navy!.source).toBe("derived");
    expect(navy!.reason).toMatch(/worn/i);
    expect(grey!.weight).toBeLessThan(navy!.weight);
  });

  it("weights stronger signal types above weaker ones", () => {
    // One wear (1.0) vs one manual_edit (0.2) — wear should rank higher.
    const profile = derivePreferenceProfile(
      {
        signals: [
          signal("wear", [{ dimension: "brand", value: "Uniqlo" }]),
          signal("manual_edit", [{ dimension: "brand", value: "Zara" }]),
        ],
      },
      { generatedAt: AT },
    );
    const uniqlo = find(profile.preferredBrands, "Uniqlo");
    const zara = find(profile.preferredBrands, "Zara");
    expect(uniqlo!.weight).toBeGreaterThan(zara!.weight);
  });

  it("recent behaviour outweighs old behaviour (recency decay)", () => {
    const profile = derivePreferenceProfile(
      {
        signals: [
          color("navy", AT), // recent
          color("olive", daysBefore(360)), // ~3 half-lives old
        ],
      },
      { generatedAt: AT },
    );
    const navy = find(profile.preferredColors, "navy");
    const olive = find(profile.preferredColors, "olive");
    expect(navy!.weight).toBe(1);
    expect(olive!.weight).toBeLessThan(navy!.weight);
  });
});

describe("derivePreferenceProfile — confidence vs stability (distinct concepts)", () => {
  it("a new-but-strong preference is high-confidence / low-stability; a long-held quiet one is the reverse", () => {
    const signals: PreferenceSignal[] = [
      // A: navy — 6 wears all recent (clustered)
      ...Array.from({ length: 6 }, () => color("navy", AT)),
      // B: grey — 4 wears spread across a year
      color("grey", daysBefore(30)),
      color("grey", daysBefore(150)),
      color("grey", daysBefore(270)),
      color("grey", daysBefore(360)),
    ];
    const profile = derivePreferenceProfile({ signals }, { generatedAt: AT });
    const navy = find(profile.preferredColors, "navy")!;
    const grey = find(profile.preferredColors, "grey")!;

    expect(navy.confidence).toBeGreaterThan(grey.confidence); // sure NOW
    expect(grey.stability).toBeGreaterThan(navy.stability); // consistent OVER TIME
    expect(navy.stability).toBeLessThan(0.5);
    expect(grey.stability).toBeGreaterThan(0.5);
  });
});

describe("derivePreferenceProfile — negative signals", () => {
  it("rejected recommendations subtract and can drop a would-be preference", () => {
    const profile = derivePreferenceProfile(
      {
        signals: [
          color("olive", AT), // +1.0
          color("olive", AT, "recommendation_rejected"), // -0.5
          color("olive", AT, "recommendation_rejected"), // -0.5
          color("olive", AT, "recommendation_rejected"), // -0.5  → net negative
          color("navy", AT),
        ],
      },
      { generatedAt: AT },
    );
    expect(find(profile.preferredColors, "olive")).toBeUndefined();
    expect(find(profile.preferredColors, "navy")).toBeTruthy();
  });
});

describe("derivePreferenceProfile — overrides win", () => {
  it("pin fixes a value at full confidence/stability even without signals", () => {
    const profile = derivePreferenceProfile(
      { signals: [color("navy")], overrides: [{ dimension: "color", value: "black", mode: "pin" }] },
      { generatedAt: AT },
    );
    const black = find(profile.preferredColors, "black")!;
    expect(black.source).toBe("override");
    expect(black.weight).toBe(1);
    expect(black.confidence).toBe(1);
    expect(black.stability).toBe(1);
  });

  it("suppress removes a derived preference", () => {
    const profile = derivePreferenceProfile(
      {
        signals: [color("navy"), color("navy")],
        overrides: [{ dimension: "color", value: "navy", mode: "suppress" }],
      },
      { generatedAt: AT },
    );
    expect(find(profile.preferredColors, "navy")).toBeUndefined();
  });

  it("adjust scales the derived weight", () => {
    const base = derivePreferenceProfile({ signals: [color("navy"), color("grey")] }, { generatedAt: AT });
    const adjusted = derivePreferenceProfile(
      {
        signals: [color("navy"), color("grey")],
        overrides: [{ dimension: "color", value: "navy", mode: "adjust", weight: 0.5 }],
      },
      { generatedAt: AT },
    );
    const navyBase = find(base.preferredColors, "navy")!;
    const navyAdj = find(adjusted.preferredColors, "navy")!;
    expect(navyAdj.weight).toBeCloseTo(navyBase.weight * 0.5, 5);
    expect(navyAdj.source).toBe("override");
  });
});

describe("derivePreferenceProfile — protected / avoided", () => {
  it("passes protected and avoided item ids through (deduped, sorted)", () => {
    const profile = derivePreferenceProfile(
      { signals: [color("navy")], protectedItemIds: ["b", "a", "a"], avoidedItemIds: ["c"] },
      { generatedAt: AT },
    );
    expect(profile.protectedItemIds).toEqual(["a", "b"]);
    expect(profile.avoidedItemIds).toEqual(["c"]);
  });
});

describe("derivePreferenceProfile — cold start", () => {
  it("falls back to the prior with low confidence when evidence is thin", () => {
    const profile = derivePreferenceProfile(
      {
        signals: [color("navy"), color("grey")], // 2 signals < MIN_EVIDENCE (5)
        prior: { preferredStyles: ["Smart Casual"], preferredFormality: ["smart_casual"] },
      },
      { generatedAt: AT },
    );
    expect(profile.coldStart).toBe(true);
    const style = find(profile.preferredStyles, "Smart Casual");
    expect(style).toBeTruthy();
    expect(style!.source).toBe("prior");
    expect(style!.confidence).toBeLessThan(0.4);
  });

  it("is not cold start once evidence passes the threshold", () => {
    const profile = derivePreferenceProfile(
      { signals: Array.from({ length: 6 }, () => color("navy")) },
      { generatedAt: AT },
    );
    expect(profile.coldStart).toBe(false);
  });
});

describe("derivePreferenceProfile — determinism", () => {
  it("same signals + overrides + generatedAt ⇒ identical profile", () => {
    const input = {
      signals: [color("navy"), color("grey", daysBefore(60))],
      overrides: [{ dimension: "color" as const, value: "black", mode: "pin" as const }],
      protectedItemIds: ["x"],
    };
    const a = derivePreferenceProfile(input, { generatedAt: AT });
    const b = derivePreferenceProfile(input, { generatedAt: AT });
    expect(a).toEqual(b);
  });

  it("records signal + override counts in metadata", () => {
    const profile = derivePreferenceProfile(
      { signals: [color("navy")], overrides: [{ dimension: "color", value: "black", mode: "pin" }] },
      { generatedAt: AT },
    );
    expect(profile.metadata.signalCount).toBe(1);
    expect(profile.metadata.overrideCount).toBe(1);
    expect(profile.metadata.generatedAt).toBe(AT);
    expect(profile.metadata.engineVersion).toBeTruthy();
  });
});

describe("deriveSignals — signal normalizer", () => {
  const navyPolo = {
    id: "polo1",
    color: "Navy",
    formality: "smart_casual",
    brand: "Uniqlo",
    styles: ["Smart Casual"],
    seasons: ["Summer"],
    category: "Polo",
    slot: "top",
    favorite: true,
    updatedAt: AT,
  };
  const sneakers = {
    id: "shoe1",
    color: "White",
    brand: "Adidas",
    category: "Sneakers",
    subcategory: "Sneakers",
    slot: "footwear",
  };

  it("extracts facets from an item", () => {
    const facets = itemFacets(navyPolo);
    expect(facets.some((f) => f.dimension === "color")).toBe(true);
    expect(facets).toContainEqual({ dimension: "formality", value: "smart_casual" });
    expect(facets).toContainEqual({ dimension: "brand", value: "Uniqlo" });
    expect(facets).toContainEqual({ dimension: "style", value: "Smart Casual" });
    expect(facets).toContainEqual({ dimension: "season", value: "Summer" });
  });

  it("classifies footwear items into the footwear dimension", () => {
    expect(itemFacets(sneakers)).toContainEqual({ dimension: "footwear", value: "Sneakers" });
  });

  it("builds wear / favourite / purchase / outfit signals with occasions", () => {
    const signals = deriveSignals(
      {
        items: [navyPolo, sneakers],
        wearEvents: [{ itemId: "polo1", wornOn: AT, occasion: "Office" }],
        purchases: [{ itemId: "shoe1", purchaseDate: daysBefore(30) }],
        savedOutfits: [{ itemIds: ["polo1", "shoe1"], favorite: true, createdAt: AT }],
      },
      AT,
    );
    const types = signals.map((s) => s.type);
    expect(types).toContain("wear");
    expect(types).toContain("favorite"); // navyPolo.favorite
    expect(types).toContain("purchase");
    expect(types).toContain("outfit_saved");

    const wear = signals.find((s) => s.type === "wear")!;
    expect(wear.facets).toContainEqual({ dimension: "occasion", value: "Office" });

    // The whole pipeline is deterministic and produces a usable profile.
    const profile = derivePreferenceProfile({ signals }, { generatedAt: AT });
    expect(profile.preferredFootwear.length).toBeGreaterThan(0);
  });
});
