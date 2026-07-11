/**
 * Inventory Image Intelligence (RFC-020) — Vitest coverage.
 */

import { describe, expect, it } from "vitest";

import type { VisionAnalysis } from "@/domain/vision";
import type { StyleDNAItem } from "@/domain/style-dna";
import {
  analyzeInventoryImage,
  mergeVisualIntoStyleDNAItem,
  visualManualDiff,
  VISUAL_CONFIDENCE_THRESHOLD,
  type VisualStyleAttributes,
} from "@/domain/inventory-image-intelligence";

function analysis(overrides: Partial<VisionAnalysis> = {}): VisionAnalysis {
  return {
    sourceType: "gallery",
    detectedItems: [
      {
        label: "Navy blazer",
        category: "outerwear",
        slot: "outerwear",
        confidence: 0.85,
        colors: [
          {
            name: "navy",
            family: "blue",
            hex: "#001f3f",
            coveragePct: 70,
            confidence: 0.9,
          },
          {
            name: "black",
            family: "neutral",
            hex: "#111",
            coveragePct: 20,
            confidence: 0.7,
          },
        ],
        material: "wool",
        texture: "woven",
        pattern: "solid",
        brandGuess: null,
        styleDNACandidate: {
          name: "Navy blazer",
          category: "outerwear",
          subcategory: "blazer",
          slot: "outerwear",
          color: "navy",
          colorFamily: "blue",
          material: "wool",
          texture: "woven",
          pattern: "solid",
          formality: "smart_casual",
          styleTags: ["structured"],
          brandGuess: null,
          confidence: 0.85,
        },
        segmentation: null,
      },
    ],
    dominantColors: [],
    material: "wool",
    texture: "woven",
    pattern: "solid",
    brand: null,
    styleDNACandidates: [],
    confidence: 0.85,
    quality: "good",
    segmentation: null,
    metadata: {
      engineVersion: "test",
      provider: "gemini",
      model: "test",
      imageHash: "abc",
      generatedAt: "2026-07-12T00:00:00.000Z",
      latencyMs: 1,
      sourceType: "gallery",
      embeddings: null,
    },
    ...overrides,
  };
}

function visual(
  overrides: Partial<VisualStyleAttributes> = {},
): VisualStyleAttributes {
  return {
    itemId: "item-1",
    imageId: "img-1",
    visionSummary: null,
    dominantColors: [
      {
        name: "navy",
        family: "blue",
        hex: null,
        coveragePct: 70,
        confidence: 0.9,
      },
    ],
    secondaryColors: [],
    pattern: "solid",
    texture: "woven",
    materialGuess: "wool",
    silhouette: "blazer",
    formalityGuess: "smart_casual",
    styleTags: ["structured"],
    confidence: 0.85,
    status: "accepted",
    ...overrides,
  };
}

describe("analyzeInventoryImage", () => {
  it("maps primary detection to pending visual attributes", () => {
    const result = analyzeInventoryImage(analysis(), {
      itemId: "item-1",
      imageId: "img-1",
    });
    expect(result.status).toBe("pending");
    expect(result.itemId).toBe("item-1");
    expect(result.imageId).toBe("img-1");
    expect(result.dominantColors[0]?.name).toBe("navy");
    expect(result.materialGuess).toBe("wool");
    expect(result.pattern).toBe("solid");
    expect(result.formalityGuess).toBe("smart_casual");
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.styleTags).toContain("structured");
    expect(result.silhouette).toBe("blazer");
  });

  it("is deterministic for the same analysis", () => {
    const a = analyzeInventoryImage(analysis(), {
      itemId: "i",
      imageId: "img",
    });
    const b = analyzeInventoryImage(analysis(), {
      itemId: "i",
      imageId: "img",
    });
    expect(a).toEqual(b);
  });

  it("falls back to aggregate cues when no detections", () => {
    const result = analyzeInventoryImage(
      analysis({
        detectedItems: [],
        styleDNACandidates: [
          {
            name: "Shirt",
            category: "tops",
            subcategory: "shirt",
            slot: "top",
            color: "white",
            colorFamily: "neutral",
            material: "cotton",
            texture: null,
            pattern: "striped",
            formality: "casual",
            styleTags: ["classic"],
            brandGuess: null,
            confidence: 0.7,
          },
        ],
        material: "cotton",
        pattern: "striped",
        confidence: 0.7,
      }),
      { itemId: "item-2", imageId: "img-2" },
    );
    expect(result.materialGuess).toBe("cotton");
    expect(result.pattern).toBe("striped");
    expect(result.formalityGuess).toBe("casual");
    expect(result.status).toBe("pending");
  });
});

describe("mergeVisualIntoStyleDNAItem", () => {
  const manual: StyleDNAItem = {
    id: "item-1",
    name: "Blazer",
    category: "outerwear",
    color: "charcoal",
    material: null,
    formality: null,
    tags: ["work"],
  };

  it("ignores null / pending / rejected / stale", () => {
    expect(
      mergeVisualIntoStyleDNAItem({ manual, visual: null }),
    ).toEqual(manual);
    expect(
      mergeVisualIntoStyleDNAItem({
        manual,
        visual: visual({ status: "pending" }),
      }).material,
    ).toBeNull();
    expect(
      mergeVisualIntoStyleDNAItem({
        manual,
        visual: visual({ status: "rejected" }),
      }).material,
    ).toBeNull();
  });

  it("keeps manual colour and fills material / formality gaps when accepted", () => {
    const merged = mergeVisualIntoStyleDNAItem({
      manual,
      visual: visual({ status: "accepted" }),
    });
    expect(merged.color).toBe("charcoal");
    expect(merged.material).toBe("wool");
    expect(merged.formality).toBe("smart_casual");
    expect(merged.tags).toContain("work");
    expect(merged.tags?.some((t) => t.includes("pattern"))).toBe(true);
  });

  it("ignores accepted attrs below confidence threshold", () => {
    const merged = mergeVisualIntoStyleDNAItem({
      manual,
      visual: visual({
        status: "accepted",
        confidence: VISUAL_CONFIDENCE_THRESHOLD - 0.01,
      }),
    });
    expect(merged.material).toBeNull();
    expect(merged.formality).toBeNull();
  });
});

describe("visualManualDiff", () => {
  it("marks gap-fill fields when manual is empty", () => {
    const diff = visualManualDiff(
      { color: null, material: null, formality: "casual", tags: [] },
      visual({ status: "pending" }),
    );
    const byField = Object.fromEntries(diff.map((d) => [d.field, d]));
    expect(byField.color?.fillsGap).toBe(true);
    expect(byField.material?.fillsGap).toBe(true);
    expect(byField.formality?.fillsGap).toBe(false);
  });
});
