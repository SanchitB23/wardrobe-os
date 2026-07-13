import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GeminiProvider,
  type GeminiClient,
  type GeminiGenerateResult,
} from "@/ai/providers/gemini-provider";
import { ProviderError, type AIRequest } from "@/ai/types";

const noSleep = async () => {};
const req: AIRequest = { prompt: "hi" };

interface CapturedCall {
  model: string;
  contents: string;
  config?: {
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    thinkingConfig?: { thinkingBudget?: number };
  };
}

/** Build a fake client that records calls and yields queued results/errors. */
function fakeClient(
  outcomes: Array<GeminiGenerateResult | Error>,
): { client: GeminiClient; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  let i = 0;
  const client: GeminiClient = {
    models: {
      async generateContent(params) {
        calls.push(params);
        const outcome = outcomes[Math.min(i, outcomes.length - 1)];
        i++;
        if (outcome instanceof Error) throw outcome;
        return outcome;
      },
    },
  };
  return { client, calls };
}

const okResult: GeminiGenerateResult = {
  text: "hello world",
  usageMetadata: {
    promptTokenCount: 3,
    candidatesTokenCount: 5,
    totalTokenCount: 8,
  },
};

describe("GeminiProvider.generate", () => {
  const savedKey = process.env.GEMINI_API_KEY;
  const savedModel = process.env.GEMINI_MODEL;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = savedKey;
    process.env.GEMINI_MODEL = savedModel;
    vi.restoreAllMocks();
  });

  it("returns text and maps usage", async () => {
    const { client } = fakeClient([okResult]);
    const provider = new GeminiProvider({ client, apiKey: "test" });

    const res = await provider.generate(req);
    expect(res.text).toBe("hello world");
    expect(res.provider).toBe("gemini");
    expect(res.usage).toEqual({
      promptTokens: 3,
      completionTokens: 5,
      totalTokens: 8,
    });
    expect(res.finishReason).toBe("stop");
  });

  it("defaults to gemini-2.5-flash", async () => {
    const { client, calls } = fakeClient([okResult]);
    const provider = new GeminiProvider({ client });

    const res = await provider.generate(req);
    expect(res.model).toBe("gemini-2.5-flash");
    expect(calls[0].model).toBe("gemini-2.5-flash");
  });

  it("honours GEMINI_MODEL and explicit model override", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-pro";
    const fromEnv = fakeClient([okResult]);
    const envProvider = new GeminiProvider({ client: fromEnv.client });
    expect((await envProvider.generate(req)).model).toBe("gemini-2.5-pro");

    const explicit = fakeClient([okResult]);
    const provider = new GeminiProvider({
      client: explicit.client,
      model: "gemini-2.5-flash-lite",
    });
    expect((await provider.generate(req)).model).toBe("gemini-2.5-flash-lite");
  });

  it("passes system instruction and JSON mode through", async () => {
    const { client, calls } = fakeClient([okResult]);
    const provider = new GeminiProvider({ client });

    await provider.generate({
      prompt: "give me json",
      system: "be terse",
      responseFormat: "json",
      temperature: 0,
      maxTokens: 100,
    });

    expect(calls[0].config?.systemInstruction).toBe("be terse");
    expect(calls[0].config?.responseMimeType).toBe("application/json");
    expect(calls[0].config?.temperature).toBe(0);
    expect(calls[0].config?.maxOutputTokens).toBe(100);
  });

  it("disables thinking on flash-family models so maxTokens is all visible output", async () => {
    const { client, calls } = fakeClient([okResult]);
    const provider = new GeminiProvider({ client });

    await provider.generate({ prompt: "json please", responseFormat: "json", maxTokens: 900 });
    expect(calls[0].config?.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("leaves thinking enabled on pro models (they reject a zero budget)", async () => {
    const { client, calls } = fakeClient([okResult]);
    const provider = new GeminiProvider({ client, model: "gemini-2.5-pro" });

    await provider.generate({ prompt: "json please", responseFormat: "json" });
    expect(calls[0].config?.thinkingConfig).toBeUndefined();
  });

  it("surfaces MAX_TOKENS truncation as finishReason 'length'", async () => {
    const truncated: GeminiGenerateResult = {
      text: '{"partial":',
      candidates: [{ finishReason: "MAX_TOKENS" }],
      usageMetadata: { promptTokenCount: 458, candidatesTokenCount: 26, totalTokenCount: 1344 },
    };
    const { client } = fakeClient([truncated]);
    const provider = new GeminiProvider({ client });

    const res = await provider.generate(req);
    expect(res.finishReason).toBe("length");
  });

  it("omits responseMimeType for text mode", async () => {
    const { client, calls } = fakeClient([okResult]);
    const provider = new GeminiProvider({ client });

    await provider.generate({ prompt: "plain" });
    expect(calls[0].config?.responseMimeType).toBeUndefined();
  });

  it("throws a clear ProviderError when the API key is missing", async () => {
    // No injected client, no env key → client construction fails fast.
    const provider = new GeminiProvider();
    await expect(provider.generate(req)).rejects.toBeInstanceOf(ProviderError);
    await expect(provider.generate(req)).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("retries once on a transient failure, then succeeds", async () => {
    const transient = Object.assign(new Error("503 Service Unavailable"), {
      status: 503,
    });
    const { client, calls } = fakeClient([transient, okResult]);
    const provider = new GeminiProvider({ client, sleep: noSleep });

    const res = await provider.generate(req);
    expect(res.text).toBe("hello world");
    expect(calls).toHaveLength(2);
  });

  it("does not retry a non-transient failure", async () => {
    const fatal = Object.assign(new Error("400 Bad Request"), { status: 400 });
    const { client, calls } = fakeClient([fatal, okResult]);
    const provider = new GeminiProvider({ client, sleep: noSleep });

    await expect(provider.generate(req)).rejects.toBeInstanceOf(ProviderError);
    expect(calls).toHaveLength(1);
  });

  it("gives up after a single retry when the failure persists", async () => {
    const transient = Object.assign(new Error("429 Too Many Requests"), {
      status: 429,
    });
    const { client, calls } = fakeClient([transient, transient]);
    const provider = new GeminiProvider({ client, sleep: noSleep });

    await expect(provider.generate(req)).rejects.toMatchObject({
      retryable: true,
    });
    expect(calls).toHaveLength(2);
  });

  it("respects retryOnceOnTransient: false", async () => {
    const transient = Object.assign(new Error("timeout"), { status: 504 });
    const { client, calls } = fakeClient([transient, okResult]);
    const provider = new GeminiProvider({
      client,
      sleep: noSleep,
      retryOnceOnTransient: false,
    });

    await expect(provider.generate(req)).rejects.toBeInstanceOf(ProviderError);
    expect(calls).toHaveLength(1);
  });

  it("treats an empty response as invalid", async () => {
    const { client } = fakeClient([{ text: "   " }]);
    const provider = new GeminiProvider({ client });

    await expect(provider.generate(req)).rejects.toMatchObject({
      code: "provider_error",
    });
  });

  it("still stubs stream() and vision() as NotImplemented", async () => {
    const provider = new GeminiProvider({ client: fakeClient([okResult]).client });
    await expect(provider.vision(req)).rejects.toMatchObject({
      code: "not_implemented",
    });
    expect(provider.capabilities).toMatchObject({ generate: true, vision: false });
  });
});
