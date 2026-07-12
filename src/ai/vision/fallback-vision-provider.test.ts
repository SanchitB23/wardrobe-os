import { describe, expect, it, vi } from "vitest";

import { FallbackVisionProvider } from "@/ai/vision/fallback-vision-provider";
import {
  VisionError,
  type RawVisionResult,
  type VisionImageInput,
  type VisionProvider,
} from "@/domain/vision";

const input: VisionImageInput = {
  kind: "base64",
  data: "AAAA",
  mimeType: "image/png",
  source: "shopping_screenshot",
};

function provider(id: string, result: RawVisionResult | Error): VisionProvider {
  return {
    id,
    capabilities: { multiItem: true, segmentation: false, brandHints: true },
    analyze: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

const geminiRaw: RawVisionResult = { provider: "gemini", model: "g", items: [] };
const openaiRaw: RawVisionResult = { provider: "openai", model: "o", items: [] };

describe("FallbackVisionProvider", () => {
  it("returns the primary result when the primary succeeds", async () => {
    const fallback = provider("openai", openaiRaw);
    const fvp = new FallbackVisionProvider({ primary: provider("gemini", geminiRaw), fallback });
    const raw = await fvp.analyze(input);
    expect(raw.provider).toBe("gemini");
    expect(fallback.analyze).not.toHaveBeenCalled();
  });

  it("falls back to OpenAI on any primary error when available", async () => {
    const fvp = new FallbackVisionProvider({
      primary: provider("gemini", new Error("429 quota")),
      fallback: provider("openai", openaiRaw),
      isFallbackAvailable: () => true,
    });
    const raw = await fvp.analyze(input);
    expect(raw.provider).toBe("openai");
  });

  it("does NOT call the fallback when it is unavailable (budget); rethrows primary error", async () => {
    const fallback = provider("openai", openaiRaw);
    const fvp = new FallbackVisionProvider({
      primary: provider("gemini", new Error("429 quota")),
      fallback,
      isFallbackAvailable: () => false,
    });
    await expect(fvp.analyze(input)).rejects.toThrow(/429 quota/);
    expect(fallback.analyze).not.toHaveBeenCalled();
  });

  it("throws a combined VisionError when both providers fail", async () => {
    const fvp = new FallbackVisionProvider({
      primary: provider("gemini", new Error("gem down")),
      fallback: provider("openai", new Error("oai down")),
      isFallbackAvailable: () => true,
    });
    await expect(fvp.analyze(input)).rejects.toBeInstanceOf(VisionError);
  });

  it("rethrows the primary error when there is no fallback arm", async () => {
    const fvp = new FallbackVisionProvider({ primary: provider("gemini", new Error("gem down")) });
    await expect(fvp.analyze(input)).rejects.toThrow(/gem down/);
  });
});
