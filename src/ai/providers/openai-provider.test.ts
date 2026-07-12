import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  OpenAIProvider,
  type OpenAIChatClient,
  type OpenAIChatParams,
  type OpenAIChatResult,
} from "@/ai/providers/openai-provider";
import { ProviderError, type AIProvider, type AIRequest, type ResponseParser } from "@/ai/types";
import { AIRuntime } from "@/runtime/ai/AIRuntime";
import type { AIRuntimePolicies } from "@/runtime/ai/types";

const noSleep = async () => {};

/** Fake OpenAI client that records calls and yields queued results/errors. */
function fakeClient(outcomes: Array<OpenAIChatResult | Error>): {
  client: OpenAIChatClient;
  calls: OpenAIChatParams[];
} {
  const calls: OpenAIChatParams[] = [];
  let i = 0;
  const client: OpenAIChatClient = {
    chat: {
      completions: {
        async create(params) {
          calls.push(params);
          const outcome = outcomes[Math.min(i, outcomes.length - 1)];
          i += 1;
          if (outcome instanceof Error) throw outcome;
          return outcome;
        },
      },
    },
  };
  return { client, calls };
}

const okResult: OpenAIChatResult = {
  choices: [{ message: { content: "hello from openai" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 },
  model: "gpt-5.5",
};

const req: AIRequest = { prompt: "hi", system: "be brief" };

describe("OpenAIProvider.generate", () => {
  const saved = {
    key: process.env.OPENAI_API_KEY,
    text: process.env.OPENAI_MODEL_TEXT,
    structured: process.env.OPENAI_MODEL_STRUCTURED,
  };

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL_TEXT;
    delete process.env.OPENAI_MODEL_STRUCTURED;
  });

  afterEach(() => {
    if (saved.key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = saved.key;
    if (saved.text === undefined) delete process.env.OPENAI_MODEL_TEXT;
    else process.env.OPENAI_MODEL_TEXT = saved.text;
    if (saved.structured === undefined) delete process.env.OPENAI_MODEL_STRUCTURED;
    else process.env.OPENAI_MODEL_STRUCTURED = saved.structured;
  });

  it("maps the request to the OpenAI chat shape (system + user, text model)", async () => {
    const { client, calls } = fakeClient([okResult]);
    const provider = new OpenAIProvider({ client });
    const res = await provider.generate(req);

    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe("gpt-5.4-mini"); // default text model (cost-first)
    expect(calls[0].messages).toEqual([
      { role: "system", content: "be brief" },
      { role: "user", content: "hi" },
    ]);
    expect(calls[0].response_format).toBeUndefined();
    expect(res.provider).toBe("openai");
    expect(res.text).toBe("hello from openai");
    expect(res.usage).toEqual({ promptTokens: 4, completionTokens: 6, totalTokens: 10 });
    expect(res.finishReason).toBe("stop");
  });

  it("sends maxTokens as max_completion_tokens (GPT-5 models reject max_tokens)", async () => {
    const { client, calls } = fakeClient([okResult]);
    const provider = new OpenAIProvider({ client });
    await provider.generate({ ...req, maxTokens: 4 });

    expect(calls[0].max_completion_tokens).toBe(4);
    expect((calls[0] as unknown as Record<string, unknown>).max_tokens).toBeUndefined();
  });

  it("uses the structured model + json response_format for structured output", async () => {
    const { client, calls } = fakeClient([
      { choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }] },
    ]);
    const provider = new OpenAIProvider({ client });
    const res = await provider.generate({ prompt: "give json", responseFormat: "json" });

    expect(calls[0].model).toBe("gpt-5.4-mini"); // default structured model
    expect(calls[0].response_format).toEqual({ type: "json_object" });
    expect(res.text).toBe('{"ok":true}');
  });

  it("honours env model overrides", async () => {
    process.env.OPENAI_MODEL_TEXT = "gpt-x";
    process.env.OPENAI_MODEL_STRUCTURED = "gpt-x-mini";
    const { client, calls } = fakeClient([okResult, okResult]);
    const provider = new OpenAIProvider({ client });
    await provider.generate({ prompt: "t" });
    await provider.generate({ prompt: "s", responseFormat: "json" });
    expect(calls[0].model).toBe("gpt-x");
    expect(calls[1].model).toBe("gpt-x-mini");
  });

  it("is unavailable when OPENAI_API_KEY is missing (non-retryable ProviderError)", async () => {
    const provider = new OpenAIProvider(); // no client, no key
    expect(provider.isAvailable()).toBe(false);
    await expect(provider.generate(req)).rejects.toBeInstanceOf(ProviderError);
    await expect(provider.generate(req)).rejects.toMatchObject({
      provider: "openai",
      retryable: false,
    });
  });

  it("normalizes provider errors and throws an empty-response ProviderError", async () => {
    const boom = new OpenAIProvider({
      client: fakeClient([new Error("upstream 400")]).client,
      retryOnceOnTransient: false,
    });
    await expect(boom.generate(req)).rejects.toMatchObject({
      provider: "openai",
      message: expect.stringContaining("OpenAI request failed: upstream 400"),
    });

    const empty = new OpenAIProvider({
      client: fakeClient([{ choices: [{ message: { content: "" } }] }]).client,
    });
    await expect(empty.generate(req)).rejects.toMatchObject({
      provider: "openai",
      message: expect.stringContaining("empty response"),
    });
  });

  it("retries once on a transient failure then succeeds", async () => {
    const { client, calls } = fakeClient([
      Object.assign(new Error("rate limit"), { status: 429 }),
      okResult,
    ]);
    const provider = new OpenAIProvider({ client, sleep: noSleep });
    const res = await provider.generate(req);
    expect(calls).toHaveLength(2);
    expect(res.text).toBe("hello from openai");
  });
});

// ---------------------------------------------------------------------------
// Integration through the AI Runtime (mocked client — never calls real OpenAI).
// ---------------------------------------------------------------------------

const policies = (p: Partial<AIRuntimePolicies>): AIRuntimePolicies => ({
  // Force OpenAI-first here so these tests exercise the OpenAI path directly.
  explanation: { primary: "openai", fallback: "gemini" },
  summarization: { primary: "openai", fallback: "gemini" },
  conversation: { primary: "openai", fallback: "gemini" },
  structured: { primary: "openai", fallback: "gemini" },
  classification: { primary: "openai", fallback: "gemini" },
  vision: { primary: "gemini" },
  image_generation: { primary: "gemini" },
  embeddings: { primary: "gemini" },
  ...p,
});

function fakeGemini(text = "gemini-fallback"): AIProvider {
  return {
    id: "gemini",
    capabilities: { generate: true, stream: false, vision: true, structuredOutput: true },
    async generate() {
      return { text, provider: "gemini", model: "gemini-2.5-flash", finishReason: "stop" };
    },
    async *stream() {},
    async vision() {
      return { text, provider: "gemini", model: "gemini-2.5-flash", finishReason: "stop" };
    },
  };
}

describe("AI Runtime — OpenAI integration + fallback", () => {
  const savedKey = process.env.OPENAI_API_KEY;
  beforeEach(() => delete process.env.OPENAI_API_KEY);
  afterEach(() => {
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedKey;
  });

  it("serves via OpenAI when a client is injected (no network)", async () => {
    const openai = new OpenAIProvider({ client: fakeClient([okResult]).client });
    const runtime = new AIRuntime({
      providers: [openai, fakeGemini()],
      policies: policies({}),
    });
    const result = await runtime.run({ capability: "explanation", request: { prompt: "why?" } });
    expect(result.servedBy).toBe("openai");
    expect(result.usedFallback).toBe(false);
    expect(result.text).toBe("hello from openai");
  });

  it("falls back to Gemini when OPENAI_API_KEY is missing, and records fallback metrics", async () => {
    const runtime = new AIRuntime({
      providers: [new OpenAIProvider(), fakeGemini()], // openai unavailable (no key/client)
      policies: policies({}),
    });
    const result = await runtime.run({ capability: "explanation", request: { prompt: "why?" } });
    expect(result.servedBy).toBe("gemini");
    expect(result.usedFallback).toBe(true);
    expect(result.text).toBe("gemini-fallback");

    const snapshot = runtime.metricsSnapshot();
    const geminiRow = snapshot.byCapabilityProvider.find(
      (r) => r.provider === "gemini" && r.capability === "explanation",
    );
    expect(geminiRow?.requests).toBe(1);
    expect(snapshot.totalRequests).toBe(1);
  });

  it("respects a structured-output schema end-to-end (parser validates)", async () => {
    const openai = new OpenAIProvider({
      client: fakeClient([
        { choices: [{ message: { content: '{"verdict":"buy"}' }, finish_reason: "stop" }] },
      ]).client,
    });
    const parser: ResponseParser<{ verdict: string }> = {
      schema: {
        name: "verdict",
        validate: (v) =>
          typeof (v as { verdict?: unknown }).verdict === "string"
            ? { valid: true }
            : { valid: false, errors: ["verdict must be a string"] },
      },
      parse: (raw) => {
        const data = JSON.parse(raw) as { verdict: string };
        return typeof data.verdict === "string"
          ? { ok: true, data }
          : { ok: false, errors: ["verdict must be a string"] };
      },
    };
    const runtime = new AIRuntime({ providers: [openai, fakeGemini()], policies: policies({}) });
    const result = await runtime.run<{ verdict: string }>({
      capability: "explanation",
      request: { prompt: "verdict?", responseFormat: "json" },
      parser,
    });
    expect(result.servedBy).toBe("openai");
    expect(result.parsed).toEqual({ verdict: "buy" });
  });

  it("keeps vision on Gemini (OpenAI is not a vision provider)", async () => {
    const openai = new OpenAIProvider({ client: fakeClient([okResult]).client });
    const runtime = new AIRuntime({ providers: [openai, fakeGemini("vision-ok")], policies: policies({}) });
    const result = await runtime.run({ capability: "vision", request: { prompt: "look" } });
    expect(result.servedBy).toBe("gemini");
  });
});
