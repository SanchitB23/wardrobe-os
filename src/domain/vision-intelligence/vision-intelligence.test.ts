/**
 * Vision Intelligence v2 (RFC-019) — pure domain tests. No live vision.
 */

import { describe, expect, it } from "vitest";

import { buildStyleDNACandidate } from "@/domain/vision";
import type { DetectedItem, VisionAnalysis } from "@/domain/vision";
import {
  analyzeVisualDuplicates,
  buildReviewQueue,
  confirmReviewItem,
  dismissReviewItem,
  recognizeOutfit,
  runClosetScan,
  scoreVisualSimilarity,
} from "@/domain/vision-intelligence";
import type { VisionInventoryItem } from "@/domain/vision-intelligence";

function detection(overrides: Partial<DetectedItem> & Pick<DetectedItem, "label">): DetectedItem {
  const category = overrides.category ?? "shirt";
  return {
    label: overrides.label,
    category,
    slot: overrides.slot ?? "top",
    colors: overrides.colors ?? [
      { name: "navy", family: "blue", hex: null, coveragePct: 80, confidence: 0.9 },
    ],
    material: overrides.material ?? "cotton",
    texture: null,
    pattern: null,
    brandGuess: null,
    segmentation: null,
    styleDNACandidate: buildStyleDNACandidate({
      name: overrides.label,
      category,
      color: "navy",
      material: "cotton",
      confidence: 0.9,
    }),
    confidence: overrides.confidence ?? 0.9,
  };
}

function analysis(items: DetectedItem[]): VisionAnalysis {
  return {
    sourceType: "closet_photo",
    detectedItems: items,
    dominantColors: [],
    material: null,
    texture: null,
    pattern: null,
    brand: null,
    styleDNACandidates: items.map((i) => i.styleDNACandidate),
    confidence: 0.85,
    quality: "good",
    segmentation: null,
    metadata: {
      engineVersion: "test",
      provider: "stub",
      model: "stub",
      generatedAt: "2026-01-01T00:00:00Z",
      latencyMs: 1,
      sourceType: "closet_photo",
      imageHash: "hash",
    },
  };
}

const inventory: VisionInventoryItem[] = [
  { id: "1", name: "Navy Oxford Shirt", category: "shirt", color: "navy", material: "cotton" },
  { id: "2", name: "Grey Chinos", category: "trousers", color: "grey", material: "cotton" },
];

describe("scoreVisualSimilarity", () => {
  it("scores a near-identical shirt highly", () => {
    const score = scoreVisualSimilarity(detection({ label: "Navy Oxford Shirt" }), inventory[0]!);
    expect(score).toBeGreaterThanOrEqual(0.72);
  });

  it("scores unrelated items low", () => {
    const score = scoreVisualSimilarity(
      detection({ label: "Red Tie", category: "accessory" }),
      inventory[1]!,
    );
    expect(score).toBeLessThan(0.45);
  });
});

describe("runClosetScan", () => {
  it("classifies new vs duplicate detections", () => {
    const result = runClosetScan(
      analysis([
        detection({ label: "Navy Oxford Shirt" }),
        detection({ label: "Emerald Bomber", category: "jacket", confidence: 0.8 }),
      ]),
      inventory,
    );
    expect(result.detections.some((d) => d.kind === "duplicate" || d.kind === "possible_match")).toBe(
      true,
    );
    expect(result.detections.some((d) => d.kind === "new")).toBe(true);
    expect(result.reviewItems.length).toBeGreaterThan(0);
    expect(result.reviewItems.every((r) => r.status === "pending")).toBe(true);
  });
});

describe("recognizeOutfit", () => {
  it("proposes inventory matches for wear logging", () => {
    const outfit = recognizeOutfit(
      analysis([detection({ label: "Navy Oxford Shirt" })]),
      inventory,
    );
    expect(outfit.matchedCount).toBe(1);
    expect(outfit.pieces[0]?.proposedItemId).toBe("1");
    expect(outfit.reviewItems.some((r) => r.kind === "log_wear")).toBe(true);
  });
});

describe("analyzeVisualDuplicates", () => {
  it("emits warnings above the duplicate threshold", () => {
    const dup = analyzeVisualDuplicates(
      analysis([detection({ label: "Navy Oxford Shirt" })]),
      inventory,
    );
    expect(dup.warningCount).toBeGreaterThan(0);
    expect(dup.hits[0]?.itemId).toBe("1");
  });
});

describe("ReviewQueue", () => {
  it("confirms and dismisses without inventing writes", () => {
    const scan = runClosetScan(
      analysis([detection({ label: "Emerald Bomber", category: "jacket" })]),
      inventory,
    );
    let queue = buildReviewQueue(scan.reviewItems);
    expect(queue.pendingCount).toBeGreaterThan(0);
    const id = queue.items[0]!.id;
    queue = confirmReviewItem(queue, id);
    expect(queue.items.find((i) => i.id === id)?.status).toBe("confirmed");
    queue = dismissReviewItem(queue, id);
    expect(queue.items.find((i) => i.id === id)?.status).toBe("dismissed");
  });
});
