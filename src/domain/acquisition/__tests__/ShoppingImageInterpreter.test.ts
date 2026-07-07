import { describe, expect, it } from "vitest";

import { interpretShoppingImage } from "@/domain/acquisition/ShoppingImageInterpreter";
import { evaluateBuyVsSkip } from "@/domain/acquisition/BuyVsSkipEngine";
import { buildStyleDNACandidate } from "@/domain/vision";
import type { DetectedItem, VisionAnalysis } from "@/domain/vision";
import type { StyleDNAItem } from "@/domain/style-dna";

function detected(overrides: Partial<DetectedItem> = {}): DetectedItem {
  const label = overrides.label ?? "Navy Knit Polo";
  return {
    label,
    category: overrides.category ?? "Polo",
    slot: overrides.slot ?? "top",
    colors: overrides.colors ?? [{ name: "Navy", family: "blue", hex: null, coveragePct: 80, confidence: 0.9 }],
    material: overrides.material ?? "Knit",
    texture: overrides.texture ?? null,
    pattern: overrides.pattern ?? null,
    brandGuess: overrides.brandGuess ?? "Levi's",
    segmentation: overrides.segmentation ?? null,
    styleDNACandidate:
      overrides.styleDNACandidate ??
      buildStyleDNACandidate({
        name: label,
        category: overrides.category ?? "Polo",
        slot: "top",
        color: "Navy",
        colorFamily: "blue",
        material: "Knit",
        formality: "smart_casual",
        styleTags: ["Smart Casual"],
        brandGuess: "Levi's",
        confidence: overrides.confidence ?? 0.9,
      }),
    confidence: overrides.confidence ?? 0.9,
  };
}

function analysis(items: DetectedItem[], overrides: Partial<VisionAnalysis> = {}): VisionAnalysis {
  const confidence = overrides.confidence ?? (items[0]?.confidence ?? 0.15);
  return {
    sourceType: "shopping_screenshot",
    detectedItems: items,
    dominantColors: [],
    material: items[0]?.material ?? null,
    texture: null,
    pattern: null,
    brand: items[0]?.brandGuess ?? null,
    styleDNACandidates: items.map((i) => i.styleDNACandidate),
    confidence,
    quality: overrides.quality ?? (confidence >= 0.65 ? "good" : confidence >= 0.4 ? "fair" : "poor"),
    segmentation: null,
    metadata: {
      engineVersion: "1.0.0",
      provider: "gemini",
      model: "gemini-2.5-flash",
      generatedAt: "2026-07-07T00:00:00.000Z",
      latencyMs: 100,
      sourceType: "shopping_screenshot",
      imageHash: "hash123",
      ...(overrides.metadata ?? {}),
    },
  };
}

describe("interpretShoppingImage", () => {
  it("maps VisionAnalysis to a ProspectiveItemCandidate", () => {
    const candidate = interpretShoppingImage(analysis([detected()]));
    expect(candidate.item).toMatchObject({
      name: "Navy Knit Polo",
      category: "Polo",
      color: "Navy",
      material: "Knit",
      brand: "Levi's",
      formality: "smart_casual",
      estimatedPrice: null, // vision omits price
    });
    expect(candidate.item.styleTags).toEqual(["Smart Casual"]);
    expect(candidate.provenance.imageHash).toBe("hash123");
    expect(candidate.provenance.visionProvider).toBe("gemini");
  });

  it("flags low-confidence fields (brand + formality always low)", () => {
    const candidate = interpretShoppingImage(analysis([detected()]));
    expect(candidate.lowConfidenceFields).toContain("brand");
    expect(candidate.lowConfidenceFields).toContain("formality");
    // High-confidence colour/name are not flagged
    expect(candidate.lowConfidenceFields).not.toContain("name");
  });

  it("marks the whole candidate low quality for a low-confidence image", () => {
    const candidate = interpretShoppingImage(
      analysis([detected({ confidence: 0.3 })], { confidence: 0.3, quality: "poor" }),
    );
    expect(candidate.quality).toBe("poor");
    expect(candidate.confidence).toBeLessThan(0.4);
  });

  it("exposes alternatives and lets the user select one (multi-product)", () => {
    const items = [
      detected({ label: "Navy Knit Polo", category: "Polo", confidence: 0.9 }),
      detected({ label: "Beige Chinos", category: "Trousers", slot: "bottom", confidence: 0.8 }),
    ];
    const primary = interpretShoppingImage(analysis(items));
    expect(primary.item.name).toBe("Navy Knit Polo");
    expect(primary.alternatives).toHaveLength(1);
    expect(primary.alternatives[0].name).toBe("Beige Chinos");

    const second = interpretShoppingImage(analysis(items), { preferItemIndex: 1 });
    expect(second.item.name).toBe("Beige Chinos");
    expect(second.alternatives[0].name).toBe("Navy Knit Polo");
  });

  it("returns an empty editable candidate when nothing is detected", () => {
    const candidate = interpretShoppingImage(analysis([], { confidence: 0.15, quality: "poor" }));
    expect(candidate.item.name).toBe("");
    expect(candidate.alternatives).toHaveLength(0);
    expect(candidate.quality).toBe("poor");
  });

  it("is deterministic for the same analysis", () => {
    const a = interpretShoppingImage(analysis([detected()]));
    const b = interpretShoppingImage(analysis([detected()]));
    expect(a).toEqual(b);
  });

  it("a corrected candidate feeds BuyVsSkipEngine deterministically (no AI)", () => {
    const candidate = interpretShoppingImage(analysis([detected()]));
    // User corrects the category + adds a price.
    const corrected = { ...candidate.item, category: "Tops", estimatedPrice: 2500 };
    const wardrobe: StyleDNAItem[] = [
      { id: "b1", name: "Beige Chinos", category: "Trousers", color: "Beige", formality: "smart_casual", rating: 8, seasons: [], styles: [], tags: [] },
      { id: "f1", name: "White Sneakers", category: "Sneakers", color: "White", formality: "casual", rating: 7, seasons: [], styles: [], tags: [] },
    ];
    const verdict = evaluateBuyVsSkip(
      { item: corrected, wardrobe },
      { generatedAt: "2026-07-07T00:00:00.000Z" },
    );
    expect(["buy", "consider", "skip"]).toContain(verdict.decision);
    expect(verdict.metadata.engineVersion).toBeTruthy();
  });
});
