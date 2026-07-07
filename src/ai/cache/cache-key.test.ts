import { describe, expect, it } from "vitest";

import { buildAICacheKey } from "@/ai/cache/cache-key";

const base = {
  promptBuilder: "recommendation-explanation",
  promptVersion: "v1",
  model: "gemini-2.5-flash",
  input: { rec: "A", score: 8 },
};

describe("buildAICacheKey", () => {
  it("is deterministic and independent of input key order", () => {
    const a = buildAICacheKey({ ...base, input: { rec: "A", score: 8 } });
    const b = buildAICacheKey({ ...base, input: { score: 8, rec: "A" } });
    expect(a.key).toBe(b.key);
    expect(a.inputHash).toBe(b.inputHash);
  });

  it("changes when the input changes", () => {
    const a = buildAICacheKey(base);
    const b = buildAICacheKey({ ...base, input: { rec: "B", score: 8 } });
    expect(a.key).not.toBe(b.key);
  });

  it("changes when the model changes", () => {
    const a = buildAICacheKey(base);
    const b = buildAICacheKey({ ...base, model: "gemini-2.5-pro" });
    expect(a.key).not.toBe(b.key);
  });

  it("changes when the prompt version changes", () => {
    const a = buildAICacheKey(base);
    const b = buildAICacheKey({ ...base, promptVersion: "v2" });
    expect(a.key).not.toBe(b.key);
  });

  it("namespaces the key by builder and version", () => {
    expect(buildAICacheKey(base).key.startsWith("recommendation-explanation:v1:")).toBe(
      true,
    );
  });
});
