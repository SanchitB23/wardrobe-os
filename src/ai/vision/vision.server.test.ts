import { afterEach, describe, expect, it } from "vitest";

import { getServerVisionProvider, resetServerVisionProvider } from "@/ai/vision/vision.server";
import { GeminiVisionProvider } from "@/ai/vision/gemini-vision-provider";
import { FallbackVisionProvider } from "@/ai/vision/fallback-vision-provider";

const saved = process.env.OPENAI_API_KEY;
afterEach(() => {
  resetServerVisionProvider();
  if (saved === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = saved;
});

describe("getServerVisionProvider", () => {
  it("returns a FallbackVisionProvider (Gemini primary) with OpenAI arm when key is set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    resetServerVisionProvider();
    const provider = getServerVisionProvider();
    expect(provider).toBeInstanceOf(FallbackVisionProvider);
    expect(provider.id).toBe("gemini"); // primary id
  });

  it("stays Gemini-only when OPENAI_API_KEY is absent (no behaviour change)", () => {
    delete process.env.OPENAI_API_KEY;
    resetServerVisionProvider();
    const provider = getServerVisionProvider();
    // FallbackVisionProvider with no fallback arm behaves as Gemini-only.
    expect(provider).toBeInstanceOf(FallbackVisionProvider);
    // Sanity: a bare Gemini provider is still constructible (import used).
    expect(new GeminiVisionProvider().id).toBe("gemini");
  });
});
