import { afterEach, describe, expect, it } from "vitest";

import { OpenAIVisionProvider, type OpenAIVisionClient } from "@/ai/vision/openai-vision-provider";
import { VisionError, type VisionImageInput } from "@/domain/vision";

const input: VisionImageInput = {
  kind: "base64",
  data: "AAAA",
  mimeType: "image/png",
  source: "shopping_screenshot",
};

function fakeClient(content: string | null): { client: OpenAIVisionClient; calls: unknown[] } {
  const calls: unknown[] = [];
  const client: OpenAIVisionClient = {
    chat: {
      completions: {
        async create(params) {
          calls.push(params);
          return { choices: [{ message: { content } }], model: "gpt-5.4-mini" };
        },
      },
    },
  };
  return { client, calls };
}

const saved = process.env.OPENAI_API_KEY;
afterEach(() => {
  if (saved === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = saved;
});

describe("OpenAIVisionProvider", () => {
  it("parses items and reports provider=openai", async () => {
    const { client, calls } = fakeClient(
      '{"items":[{"label":"blue shirt","category":"top","confidence":0.9}]}',
    );
    const provider = new OpenAIVisionProvider({ client });
    const raw = await provider.analyze(input);

    expect(raw.provider).toBe("openai");
    expect(raw.items).toHaveLength(1);
    expect(raw.items[0]).toMatchObject({ label: "blue shirt", category: "top" });
    // Image is sent as a data URL content part, capped via max_completion_tokens.
    const params = calls[0] as {
      max_completion_tokens?: number;
      messages: { content: Array<{ type: string; image_url?: { url: string } }> }[];
    };
    expect(params.max_completion_tokens).toBeGreaterThan(0);
    const imagePart = params.messages[0].content.find((c) => c.type === "image_url");
    expect(imagePart?.image_url?.url).toBe("data:image/png;base64,AAAA");
  });

  it("returns empty items (no throw) on empty/garbage content", async () => {
    const { client } = fakeClient(null);
    const provider = new OpenAIVisionProvider({ client });
    const raw = await provider.analyze(input);
    expect(raw.items).toEqual([]);
  });

  it("throws VisionError when no API key and no injected client", async () => {
    delete process.env.OPENAI_API_KEY;
    const provider = new OpenAIVisionProvider();
    await expect(provider.analyze(input)).rejects.toBeInstanceOf(VisionError);
  });
});
