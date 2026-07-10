import { describe, expect, it } from "vitest";

import { InMemoryAICache } from "@/ai/cache";
import { ClaudeProvider, GeminiProvider, OpenAIProvider } from "@/ai/providers";
import { createJsonResponseParser, objectSchema } from "@/ai/schemas";
import { AIOrchestrator } from "@/ai/orchestrator/ai-orchestrator";
import {
  AIError,
  NotImplementedError,
  ParseError,
  ProviderError,
  type AICapabilities,
  type AILogRecord,
  type AIProvider,
  type AIProviderId,
  type AIRequest,
  type AIResponse,
  type AIStreamChunk,
} from "@/ai/types";

const ALL_CAPS: AICapabilities = {
  generate: true,
  stream: true,
  vision: true,
  structuredOutput: true,
};

function response(provider: AIProviderId, text: string): AIResponse {
  return {
    text,
    provider,
    model: "fake",
    finishReason: "stop",
  };
}

/** A configurable fake provider for exercising orchestrator control flow. */
class FakeProvider implements AIProvider {
  calls = 0;
  constructor(
    readonly id: AIProviderId,
    private readonly behavior: {
      failTimes?: number;
      error?: () => Error;
      text?: string;
      capabilities?: AICapabilities;
    } = {},
  ) {}

  get capabilities(): AICapabilities {
    return this.behavior.capabilities ?? ALL_CAPS;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    void request;
    this.calls++;
    const failTimes = this.behavior.failTimes ?? 0;
    if (this.calls <= failTimes) {
      throw (this.behavior.error ?? (() => new ProviderError(this.id, "boom")))();
    }
    return response(this.id, this.behavior.text ?? "ok");
  }

  async *stream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    void request;
    yield { delta: this.behavior.text ?? "hi", done: true };
  }

  async vision(request: AIRequest): Promise<AIResponse> {
    return this.generate(request);
  }
}

const noSleep = async () => {};
const req: AIRequest = { prompt: "hello" };

describe("AIOrchestrator", () => {
  it("selects the first capable provider in order", async () => {
    const a = new FakeProvider("gemini", { text: "from-a" });
    const b = new FakeProvider("openai", { text: "from-b" });
    const orch = new AIOrchestrator({ providers: [a, b], sleep: noSleep });

    const res = await orch.generate(req);
    expect(res.text).toBe("from-a");
    expect(res.provider).toBe("gemini");
    expect(b.calls).toBe(0);
  });

  it("honours a forced provider", async () => {
    const a = new FakeProvider("gemini", { text: "a" });
    const b = new FakeProvider("openai", { text: "b" });
    const orch = new AIOrchestrator({ providers: [a, b], sleep: noSleep });

    const res = await orch.generate(req, { provider: "openai" });
    expect(res.provider).toBe("openai");
    expect(a.calls).toBe(0);
  });

  it("skips providers lacking the capability", async () => {
    const noVision = new FakeProvider("gemini", {
      capabilities: { ...ALL_CAPS, vision: false },
    });
    const withVision = new FakeProvider("openai", { text: "seen" });
    const orch = new AIOrchestrator({
      providers: [noVision, withVision],
      sleep: noSleep,
    });

    const res = await orch.vision({ prompt: "look", images: [] });
    expect(res.provider).toBe("openai");
    expect(noVision.calls).toBe(0);
  });

  it("retries a retryable failure then succeeds on the same provider", async () => {
    const flaky = new FakeProvider("gemini", { failTimes: 1, text: "recovered" });
    const orch = new AIOrchestrator({ providers: [flaky], sleep: noSleep });

    const res = await orch.generate(req, { retries: 3 });
    expect(res.text).toBe("recovered");
    expect(flaky.calls).toBe(2);
  });

  it("falls back to the next provider when the first exhausts retries", async () => {
    const broken = new FakeProvider("gemini", {
      failTimes: 99,
      error: () => new ProviderError("gemini", "always down"),
    });
    const backup = new FakeProvider("openai", { text: "backup" });
    const orch = new AIOrchestrator({
      providers: [broken, backup],
      retryPolicy: { maxAttempts: 2, initialDelayMs: 1, backoffFactor: 2 },
      sleep: noSleep,
    });

    const res = await orch.generate(req);
    expect(res.provider).toBe("openai");
    expect(res.text).toBe("backup");
  });

  it("aborts immediately on a non-retryable error without falling back", async () => {
    const fatal = new FakeProvider("gemini", {
      failTimes: 1,
      error: () => new AIError("provider_error", "fatal", { retryable: false }),
    });
    const backup = new FakeProvider("openai", { text: "unused" });
    const orch = new AIOrchestrator({ providers: [fatal, backup], sleep: noSleep });

    await expect(orch.generate(req)).rejects.toThrow("fatal");
    expect(backup.calls).toBe(0);
  });

  it("throws no_provider when nothing supports the capability", async () => {
    const noGen = new FakeProvider("gemini", {
      capabilities: { ...ALL_CAPS, generate: false },
    });
    const orch = new AIOrchestrator({ providers: [noGen], sleep: noSleep });

    await expect(orch.generate(req)).rejects.toMatchObject({ code: "no_provider" });
  });

  const cacheDescriptor = (input: unknown) => ({
    promptBuilder: "test-builder",
    promptVersion: "v1",
    model: "gemini-2.5-flash",
    input,
  });

  it("same input hits the cache (provider called once, cached flag set)", async () => {
    const provider = new FakeProvider("gemini", { text: "computed" });
    const cache = new InMemoryAICache();
    const orch = new AIOrchestrator({ providers: [provider], cache, sleep: noSleep });

    const first = await orch.generate(req, { cache: cacheDescriptor({ a: 1 }) });
    expect(first.text).toBe("computed");
    expect(first.cached).toBe(false);
    expect(provider.calls).toBe(1);

    const second = await orch.generate(req, { cache: cacheDescriptor({ a: 1 }) });
    expect(second.text).toBe("computed");
    expect(second.cached).toBe(true);
    expect(provider.calls).toBe(1); // served from cache
  });

  it("changed input misses the cache", async () => {
    const provider = new FakeProvider("gemini", { text: "computed" });
    const cache = new InMemoryAICache();
    const orch = new AIOrchestrator({ providers: [provider], cache, sleep: noSleep });

    await orch.generate(req, { cache: cacheDescriptor({ rec: "A" }) });
    await orch.generate(req, { cache: cacheDescriptor({ rec: "B" }) });
    expect(provider.calls).toBe(2); // different input → different key → miss
  });

  it("forceRefresh bypasses a cache hit and overwrites it", async () => {
    const provider = new FakeProvider("gemini", { text: "computed" });
    const cache = new InMemoryAICache();
    const orch = new AIOrchestrator({ providers: [provider], cache, sleep: noSleep });

    await orch.generate(req, { cache: cacheDescriptor({ a: 1 }) });
    expect(provider.calls).toBe(1);

    const refreshed = await orch.generate(req, {
      cache: cacheDescriptor({ a: 1 }),
      forceRefresh: true,
    });
    expect(refreshed.cached).toBe(false);
    expect(provider.calls).toBe(2); // provider called again despite a cached entry
  });

  it("expired entries miss the cache", async () => {
    const provider = new FakeProvider("gemini", { text: "computed" });
    let nowMs = 1_000_000;
    const clock = () => nowMs;
    const cache = new InMemoryAICache({ now: clock });
    const orch = new AIOrchestrator({
      providers: [provider],
      cache,
      sleep: noSleep,
      now: clock,
    });

    await orch.generate(req, {
      cache: { ...cacheDescriptor({ a: 1 }), ttlSeconds: 60 },
    });
    expect(provider.calls).toBe(1);

    nowMs += 61_000; // advance past the 60s TTL
    const afterExpiry = await orch.generate(req, {
      cache: { ...cacheDescriptor({ a: 1 }), ttlSeconds: 60 },
    });
    expect(afterExpiry.cached).toBe(false);
    expect(provider.calls).toBe(2); // regenerated after expiry
  });

  it("attaches parsed output and validates via a parser", async () => {
    const schema = objectSchema<{ name: string }>({
      name: "Named",
      fields: { name: { type: "string" } },
    });
    const provider = new FakeProvider("gemini", { text: '{"name":"Sanchit"}' });
    const orch = new AIOrchestrator({ providers: [provider], sleep: noSleep });

    const res = await orch.generate(req, {
      parser: createJsonResponseParser(schema),
    });
    expect(res.parsed).toEqual({ name: "Sanchit" });
  });

  it("throws ParseError when structured output fails validation", async () => {
    const schema = objectSchema<{ name: string }>({
      name: "Named",
      fields: { name: { type: "string" } },
    });
    const provider = new FakeProvider("gemini", { text: '{"wrong":1}' });
    const orch = new AIOrchestrator({ providers: [provider], sleep: noSleep });

    await expect(
      orch.generate(req, { parser: createJsonResponseParser(schema) }),
    ).rejects.toBeInstanceOf(ParseError);
  });

  it("emits log records through the injected logger", async () => {
    const records: AILogRecord[] = [];
    const provider = new FakeProvider("gemini", { text: "ok" });
    const orch = new AIOrchestrator({
      providers: [provider],
      logger: { log: (r) => records.push(r) },
      sleep: noSleep,
    });

    await orch.generate(req);
    expect(records.some((r) => r.message === "provider call ok")).toBe(true);
  });

  it("streams chunks from the first stream-capable provider", async () => {
    const provider = new FakeProvider("gemini", { text: "streamed" });
    const orch = new AIOrchestrator({ providers: [provider], sleep: noSleep });

    const chunks: AIStreamChunk[] = [];
    for await (const chunk of orch.stream(req)) chunks.push(chunk);
    expect(chunks).toEqual([{ delta: "streamed", done: true }]);
  });
});

describe("provider stubs", () => {
  // Gemini + OpenAI implement generate() (RFC-014A); Claude is still a full stub.
  // vision() / stream() remain stubs on every provider.
  const generateStubs: AIProvider[] = [new ClaudeProvider()];
  const allProviders: AIProvider[] = [
    new GeminiProvider(),
    new OpenAIProvider(),
    new ClaudeProvider(),
  ];

  it.each(generateStubs)("%s throws NotImplementedError from generate()", async (p) => {
    await expect(p.generate(req)).rejects.toBeInstanceOf(NotImplementedError);
  });

  it.each(allProviders)("%s throws NotImplementedError from vision()", async (p) => {
    await expect(p.vision(req)).rejects.toBeInstanceOf(NotImplementedError);
  });

  it.each(allProviders)("%s throws NotImplementedError from stream()", async (p) => {
    await expect(async () => {
      for await (const _ of p.stream(req)) void _;
    }).rejects.toBeInstanceOf(NotImplementedError);
  });
});
