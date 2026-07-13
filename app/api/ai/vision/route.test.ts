/**
 * /api/ai/vision — usedFallback reporting (RFC-029 final-review fix).
 *
 * Gemini is always the vision primary (see src/ai/vision/vision.server.ts), so
 * "served by any non-gemini provider" means the fallback path handled the
 * request. Verifies the success-path ai_usage log + runtime metrics record
 * usedFallback correctly for both the gemini (no fallback) and openai
 * (fallback served) cases.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { RawVisionResult, VisionProvider } from "@/domain/vision";

const logAIUsageMock = vi.fn();
const recordMock = vi.fn();

vi.mock("@/runtime/logging/ai-usage-logger", () => ({
  logAIUsage: (...args: unknown[]) => logAIUsageMock(...args),
}));

vi.mock("@/runtime/ai", () => ({
  aiRuntimeMetrics: { record: (...args: unknown[]) => recordMock(...args) },
}));

const getServerVisionProviderMock = vi.fn();
vi.mock("@/ai/vision/vision.server", () => ({
  getServerVisionProvider: () => getServerVisionProviderMock(),
}));

function stubProvider(result: RawVisionResult): VisionProvider {
  return {
    id: result.provider,
    capabilities: { multiItem: false, segmentation: false, brandHints: false },
    analyze: vi.fn().mockResolvedValue(result),
  };
}

function makeRequest(): Request {
  return new Request("http://localhost/api/ai/vision", {
    method: "POST",
    body: JSON.stringify({
      imageBase64: "data".repeat(10),
      mimeType: "image/png",
      source: "gallery",
    }),
  });
}

describe("POST /api/ai/vision — usedFallback", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("reports usedFallback: false when Gemini (primary) serves the request", async () => {
    getServerVisionProviderMock.mockReturnValue(
      stubProvider({ provider: "gemini", model: "gemini-2.5-flash", items: [] }),
    );
    const { POST } = await import("@/app/api/ai/vision/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    expect(logAIUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ok", provider: "gemini", usedFallback: false }),
    );
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, provider: "gemini", usedFallback: false }),
    );
  });

  it("reports usedFallback: true when the OpenAI fallback serves the request", async () => {
    getServerVisionProviderMock.mockReturnValue(
      stubProvider({ provider: "openai", model: "gpt-4o-mini", items: [] }),
    );
    const { POST } = await import("@/app/api/ai/vision/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    expect(logAIUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ok", provider: "openai", usedFallback: true }),
    );
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, provider: "openai", usedFallback: true }),
    );
  });
});
