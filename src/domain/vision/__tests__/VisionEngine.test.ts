import { describe, expect, it } from "vitest";

import { analyzeImage } from "@/domain/vision/VisionEngine";
import { normalizeVision } from "@/domain/vision/VisionNormalizer";
import { computeImageHash } from "@/domain/vision/VisionMetadata";
import { qualityFromConfidence } from "@/domain/vision/VisionConfidence";
import {
  StubVisionProvider,
  VisionError,
  VisionNotImplementedError,
  type VisionProvider,
} from "@/domain/vision/VisionProvider";
import type {
  RawVisionResult,
  VisionImageInput,
} from "@/domain/vision/VisionAnalysis";

const AT = "2026-07-07T00:00:00.000Z";

const input: VisionImageInput = {
  kind: "base64",
  data: "ABC123",
  mimeType: "image/jpeg",
  source: "closet_photo",
};

const rawTwoItems: RawVisionResult = {
  provider: "fake",
  model: "fake-vision",
  items: [
    {
      label: "Navy Knit Polo",
      category: "Polo",
      colors: [{ name: "Navy", coveragePct: 80 }],
      material: "Knit",
      pattern: "Solid",
      brand: "Levi's",
      confidence: 0.9,
      boundingBox: { x: 10, y: 10, width: 100, height: 120 },
    },
    {
      label: "Beige Chinos",
      category: "Trousers",
      colors: [{ name: "Beige", coveragePct: 90 }],
      material: "Cotton",
      confidence: 0.7,
    },
    { label: "", confidence: 0.9 }, // junk — dropped by Validate
    { label: "Blurry thing", confidence: 0.05 }, // below threshold — dropped
  ],
};

function fakeProvider(raw: RawVisionResult): VisionProvider {
  return {
    id: "fake",
    capabilities: { multiItem: true, segmentation: true, brandHints: true },
    async analyze() {
      return raw;
    },
  };
}

describe("normalizeVision", () => {
  it("maps raw items to canonical detected items + candidates", () => {
    const result = normalizeVision(rawTwoItems, input, { generatedAt: AT, latencyMs: 5 });

    expect(result.detectedItems).toHaveLength(2); // junk + low-conf dropped
    const [polo, chinos] = result.detectedItems;
    expect(polo).toMatchObject({ label: "Navy Knit Polo", slot: "top" });
    expect(polo.colors[0]).toMatchObject({ name: "Navy", family: "blue" });
    expect(chinos.slot).toBe("bottom");
    // StyleDNACandidate derived per item
    expect(polo.styleDNACandidate).toMatchObject({
      slot: "top",
      color: "Navy",
      colorFamily: "blue",
      material: "Knit",
      brandGuess: "Levi's",
    });
    expect(result.styleDNACandidates).toHaveLength(2);
  });

  it("aggregates dominant colours, cues, and segmentation", () => {
    const result = normalizeVision(rawTwoItems, input, { generatedAt: AT });
    expect(result.dominantColors.map((c) => c.family)).toContain("blue");
    expect(result.material).toBe("Knit");
    expect(result.brand).toBe("Levi's");
    expect(result.segmentation).toHaveLength(1); // only the polo had a box
    expect(result.sourceType).toBe("closet_photo");
  });

  it("computes overall confidence + quality band", () => {
    const result = normalizeVision(rawTwoItems, input, { generatedAt: AT });
    // mean(0.9, 0.7) = 0.8 → "good"
    expect(result.confidence).toBeCloseTo(0.8, 5);
    expect(result.quality).toBe("good");
  });

  it("is deterministic for the same raw + generatedAt", () => {
    const a = normalizeVision(rawTwoItems, input, { generatedAt: AT, latencyMs: 0 });
    const b = normalizeVision(rawTwoItems, input, { generatedAt: AT, latencyMs: 0 });
    expect(a).toEqual(b);
  });

  it("returns poor quality + empty items when nothing is detected", () => {
    const result = normalizeVision(
      { provider: "fake", model: "m", items: [] },
      input,
      { generatedAt: AT },
    );
    expect(result.detectedItems).toHaveLength(0);
    expect(result.quality).toBe("poor");
    expect(result.confidence).toBeLessThan(0.4);
  });
});

describe("qualityFromConfidence bands", () => {
  it("maps at each boundary", () => {
    expect(qualityFromConfidence(0.39)).toBe("poor");
    expect(qualityFromConfidence(0.4)).toBe("fair");
    expect(qualityFromConfidence(0.64)).toBe("fair");
    expect(qualityFromConfidence(0.65)).toBe("good");
    expect(qualityFromConfidence(0.84)).toBe("good");
    expect(qualityFromConfidence(0.85)).toBe("excellent");
  });
});

describe("computeImageHash", () => {
  it("is stable for identical bytes and differs otherwise", () => {
    expect(computeImageHash(input)).toBe(computeImageHash({ ...input }));
    expect(computeImageHash(input)).not.toBe(computeImageHash({ ...input, data: "XYZ" }));
  });
});

describe("analyzeImage (pipeline)", () => {
  it("runs preprocess → provider → normalize and stamps latency + imageHash", async () => {
    let t = 1000;
    const result = await analyzeImage(input, {
      provider: fakeProvider(rawTwoItems),
      generatedAt: AT,
      now: () => (t += 20),
    });
    expect(result.detectedItems).toHaveLength(2);
    expect(result.metadata.imageHash).toBe(computeImageHash(input));
    expect(result.metadata.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.provider).toBe("fake");
  });

  it("rejects invalid input before calling the provider", async () => {
    await expect(
      analyzeImage({ ...input, data: "" }, { provider: fakeProvider(rawTwoItems) }),
    ).rejects.toBeInstanceOf(VisionError);
    await expect(
      analyzeImage({ ...input, mimeType: "application/pdf" }, { provider: fakeProvider(rawTwoItems) }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("wraps provider failures as a VisionError", async () => {
    const boom: VisionProvider = {
      id: "boom",
      capabilities: { multiItem: false, segmentation: false, brandHints: false },
      async analyze() {
        throw new Error("model down");
      },
    };
    await expect(analyzeImage(input, { provider: boom })).rejects.toMatchObject({
      code: "provider_error",
    });
  });

  it("provider stubs throw NotImplemented", async () => {
    class OpenAIStub extends StubVisionProvider {
      readonly id = "openai";
      readonly capabilities = { multiItem: true, segmentation: false, brandHints: true };
    }
    await expect(new OpenAIStub().analyze(input)).rejects.toBeInstanceOf(VisionNotImplementedError);
  });
});
