import { describe, expect, it } from "vitest";

import { buildPairingReport } from "@/domain/pairing/ItemPairingEngine";
import { deriveStyleDNA, type StyleDNAItem } from "@/domain/style-dna";

function item(overrides: Partial<StyleDNAItem> = {}): StyleDNAItem {
  return {
    id: overrides.id ?? "i1",
    name: "Item",
    category: "T-Shirts",
    subcategory: null,
    color: "Black",
    colorFamily: null,
    brand: null,
    formality: "casual",
    usage: "regular",
    rating: 8,
    material: "Cotton",
    seasons: ["Year Round"],
    styles: ["Casual"],
    tags: ["Social"],
    ...overrides,
  };
}

function entry(overrides: Partial<StyleDNAItem> = {}) {
  const styleItem = item(overrides);
  return { item: styleItem, dna: deriveStyleDNA(styleItem) };
}

/** Core slots covered: two bottoms, two footwear, one other top. */
function coreWardrobe() {
  return [
    entry({ id: "t2", name: "White Oxford Shirt", category: "Shirts", color: "White", formality: "smart_casual" }),
    entry({ id: "b1", name: "Beige Chino Pants", category: "Pants", color: "Beige", formality: "smart_casual", rating: 9 }),
    entry({ id: "b2", name: "Dark Jeans", category: "Jeans", color: "Blue", formality: "casual", rating: 7 }),
    entry({ id: "f1", name: "White Sneakers", category: "Sneakers", color: "White", formality: "casual", rating: 8 }),
    entry({ id: "f2", name: "Brown Loafers", category: "Loafers", color: "Brown", formality: "smart_casual", rating: 6 }),
  ];
}

const blackTee = () => entry({ id: "a1", name: "Black T-Shirt" });

describe("buildPairingReport", () => {
  it("pairs a top anchor with bottoms and footwear, never its own slot", () => {
    const report = buildPairingReport(blackTee(), coreWardrobe());

    expect(report.anchorItemId).toBe("a1");
    expect(report.anchorSlot).toBe("top");
    expect(Object.keys(report.pairingsBySlot).sort()).toEqual(["bottom", "footwear"]);
    expect(report.pairingsBySlot.bottom?.length).toBeGreaterThan(0);
    expect(report.pairingsBySlot.footwear?.length).toBeGreaterThan(0);
    expect(report.outfits.length).toBeGreaterThan(0);

    for (const outfit of report.outfits) {
      expect(outfit.itemNames[0]).toBe("Black T-Shirt");
      expect(outfit.itemIds).not.toContain("a1");
      expect(outfit.itemIds).toHaveLength(2); // one bottom + one footwear
      expect(outfit.score).toBeGreaterThanOrEqual(0);
      expect(outfit.score).toBeLessThanOrEqual(10);
    }
  });

  it("excludes the anchor from the candidate pool when present in the wardrobe", () => {
    const anchor = blackTee();
    const report = buildPairingReport(anchor, [...coreWardrobe(), anchor]);

    const allPairedIds = Object.values(report.pairingsBySlot)
      .flat()
      .map((p) => p.itemId);
    expect(allPairedIds).not.toContain("a1");
  });

  it("keeps pairing scores consistent with anchored outfit scores", () => {
    const report = buildPairingReport(blackTee(), coreWardrobe());
    const best = report.outfits[0];
    const pairings = Object.values(report.pairingsBySlot).flat();

    // Every member of the best outfit carries the best outfit's score as its
    // pairing score (per-item score = max participating outfit score).
    for (const id of best.itemIds) {
      const pairing = pairings.find((p) => p.itemId === id);
      expect(pairing).toBeDefined();
      expect(pairing?.score).toBe(best.score);
    }
  });

  it("carries non-empty reasons derived from the outfit analysis breakdown", () => {
    const report = buildPairingReport(blackTee(), coreWardrobe());
    for (const pairing of Object.values(report.pairingsBySlot).flat()) {
      expect(pairing.reasons.length).toBeGreaterThanOrEqual(2);
      for (const reason of pairing.reasons) {
        expect(reason.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("is deterministic: identical inputs produce identical reports", () => {
    const a = buildPairingReport(blackTee(), coreWardrobe());
    const b = buildPairingReport(blackTee(), coreWardrobe());
    expect(a).toEqual(b);
  });

  it("honours topKPerSlot config (rating desc, name asc)", () => {
    const report = buildPairingReport(blackTee(), coreWardrobe(), { topKPerSlot: 1 });

    // Only the single top-rated item per slot may appear.
    expect(report.pairingsBySlot.bottom?.map((p) => p.itemId)).toEqual(["b1"]);
    expect(report.pairingsBySlot.footwear?.map((p) => p.itemId)).toEqual(["f1"]);
  });

  it("caps candidate outfits and returned outfits", () => {
    const report = buildPairingReport(blackTee(), coreWardrobe(), {
      maxCandidates: 2,
      maxReturnedOutfits: 1,
    });
    expect(report.outfits).toHaveLength(1);
  });

  it("reports SLOT_EMPTY and fabricates nothing when a core slot is missing", () => {
    const noFootwear = coreWardrobe().filter((e) => e.dna.slot !== "footwear");
    const report = buildPairingReport(blackTee(), noFootwear);

    expect(report.codes).toContain("SLOT_EMPTY");
    expect(report.outfits).toEqual([]);
    expect(Object.values(report.pairingsBySlot).flat()).toEqual([]);
  });

  it("does not compute pairings for an inactive anchor", () => {
    const anchor = { ...blackTee(), active: false };
    const report = buildPairingReport(anchor, coreWardrobe());

    expect(report.codes).toContain("ANCHOR_INACTIVE");
    expect(report.outfits).toEqual([]);
    expect(Object.values(report.pairingsBySlot).flat()).toEqual([]);
  });

  it("builds top+bottom+footwear around an outerwear anchor", () => {
    const jacket = entry({ id: "o1", name: "Navy Bomber Jacket", category: "Jackets", color: "Navy" });
    const report = buildPairingReport(jacket, coreWardrobe());

    expect(report.anchorSlot).toBe("outerwear");
    expect(Object.keys(report.pairingsBySlot).sort()).toEqual(["bottom", "footwear", "top"]);
    for (const outfit of report.outfits) {
      expect(outfit.itemNames).toHaveLength(4); // anchor + 3 core slots
      expect(outfit.itemNames[0]).toBe("Navy Bomber Jacket");
    }
  });

  it("flags outfit strength with PAIRING_STRONG or PAIRING_WEAK", () => {
    const report = buildPairingReport(blackTee(), coreWardrobe());
    const hasStrength =
      report.codes.includes("PAIRING_STRONG") || report.codes.includes("PAIRING_WEAK");
    expect(hasStrength).toBe(true);
  });

  it("stamps the engine version", () => {
    const report = buildPairingReport(blackTee(), coreWardrobe());
    expect(report.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
