# Vision Fallback + Unified Buy-vs-Skip Advisor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a budget-gated OpenAI vision fallback to the Vision Engine and merge the advisor + screenshot pages into one `/acquisition/advisor`.

**Architecture:** New `OpenAIVisionProvider` and `FallbackVisionProvider` both implement the existing domain `VisionProvider` interface (`analyze(input) → RawVisionResult`). The vision composition root (`vision.server.ts`) wraps Gemini→OpenAI with a budget gate. Vision stays OUT of the AI Runtime router (RFC-002 separation preserved). The UI promotes the richer `ScreenshotAdvisorView` to the single advisor, ungating its form for manual entry.

**Tech Stack:** TypeScript, Next.js (App Router — this repo's Next differs from stock; read `node_modules/next/dist/docs/` before touching routes), Vitest (node env — no React Testing Library), `openai` SDK, `@google/genai`.

## Global Constraints

- Domain (`src/domain/**`) stays pure — the new providers live in `src/ai/vision/` (I/O allowed there), implementing the pure `VisionProvider` interface. Do not add SDK/React/Supabase to `src/domain`.
- AI never decides (ADR-005): vision only reads the image into a `RawVisionResult`; `BuyVsSkipEngine` decides. Unchanged.
- OpenAI chat completions MUST use `max_completion_tokens`, never `max_tokens` (GPT-5 models reject the latter).
- OpenAI is OPTIONAL: with no `OPENAI_API_KEY`, behaviour must be identical to today (Gemini-only, no fallback arm).
- Tests run under Vitest `environment: "node"` — no DOM. UI changes are verified by `tsc --noEmit` + browser preview, not unit tests.
- Commits: Conventional Commits; end every commit message with a trailer line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- `OPENAI_MODEL_VISION` env var already exists in `.env.example` / `.env.local` (default `gpt-5.4-mini`).

---

### Task 1: Shared `parseVisionItems` helper

**Files:**
- Create: `src/ai/vision/parse-vision-items.ts`
- Test: `src/ai/vision/parse-vision-items.test.ts`
- Modify: `src/ai/vision/gemini-vision-provider.ts` (remove its private `parseItems`, import the shared helper)

**Interfaces:**
- Consumes: `RawDetectedItem` from `@/domain/vision`.
- Produces: `export function parseVisionItems(text: string | null | undefined): RawDetectedItem[]` — tolerant parser for model JSON (`{"items":[…]}`), handling code fences / prose wrapping; returns `[]` on failure. Used by both the Gemini and OpenAI vision providers.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/vision/parse-vision-items.test.ts
import { describe, expect, it } from "vitest";

import { parseVisionItems } from "@/ai/vision/parse-vision-items";

describe("parseVisionItems", () => {
  it("parses a plain JSON object", () => {
    expect(parseVisionItems('{"items":[{"label":"shirt"}]}')).toEqual([{ label: "shirt" }]);
  });

  it("parses fenced JSON", () => {
    expect(parseVisionItems('```json\n{"items":[{"label":"shoe"}]}\n```')).toEqual([
      { label: "shoe" },
    ]);
  });

  it("parses JSON embedded in prose", () => {
    expect(parseVisionItems('Here you go: {"items":[{"label":"hat"}]} done')).toEqual([
      { label: "hat" },
    ]);
  });

  it("returns [] for null/empty/garbage", () => {
    expect(parseVisionItems(null)).toEqual([]);
    expect(parseVisionItems("")).toEqual([]);
    expect(parseVisionItems("not json")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ai/vision/parse-vision-items.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the shared helper**

```ts
// src/ai/vision/parse-vision-items.ts
/**
 * Tolerant parser for a vision model's JSON garment output (RFC-029). Accepts
 * `{"items":[…]}` optionally wrapped in code fences or prose; returns [] on
 * failure. Shared by the Gemini and OpenAI vision providers. Pure.
 */

import type { RawDetectedItem } from "@/domain/vision";

export function parseVisionItems(text: string | null | undefined): RawDetectedItem[] {
  if (!text) return [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text, text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as { items?: RawDetectedItem[] };
      if (Array.isArray(parsed.items)) return parsed.items;
    } catch {
      // try next candidate
    }
  }
  return [];
}
```

- [ ] **Step 4: Refactor `GeminiVisionProvider` to use it**

In `src/ai/vision/gemini-vision-provider.ts`: delete the private `function parseItems(text: string | undefined): RawDetectedItem[] { … }` (lines ~50–65), add `import { parseVisionItems } from "@/ai/vision/parse-vision-items";`, and change the one call site `items: parseItems(response.text),` → `items: parseVisionItems(response.text),`. The `RawDetectedItem` import in that file may become unused — remove it if so.

- [ ] **Step 5: Run tests to verify green**

Run: `npx vitest run src/ai/vision/parse-vision-items.test.ts src/ai/vision/ && npx tsc --noEmit`
Expected: PASS; tsc clean (Gemini vision behaviour unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/ai/vision/parse-vision-items.ts src/ai/vision/parse-vision-items.test.ts src/ai/vision/gemini-vision-provider.ts
git commit -m "$(printf 'refactor(vision): extract shared parseVisionItems helper\n\nRFC-029. Pull the tolerant JSON parser out of GeminiVisionProvider so the\nnew OpenAIVisionProvider can reuse it (DRY). Behaviour unchanged.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: OpenAIVisionProvider

**Files:**
- Create: `src/ai/vision/openai-vision-provider.ts`
- Test: `src/ai/vision/openai-vision-provider.test.ts`

**Interfaces:**
- Consumes: `VisionProvider`, `VisionError`, `VisionCapabilities`, `VisionProviderId`, `RawVisionResult`, `VisionImageInput` from `@/domain/vision`; `parseVisionItems` from `@/ai/vision/parse-vision-items` (Task 1).
- Produces: `class OpenAIVisionProvider implements VisionProvider` with `id: "openai"`, `analyze(input: VisionImageInput): Promise<RawVisionResult>`, and an injectable `OpenAIVisionProviderConfig { apiKey?: string; model?: string; client?: OpenAIVisionClient }`. Exports `type OpenAIVisionClient`.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/vision/openai-vision-provider.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ai/vision/openai-vision-provider.test.ts`
Expected: FAIL — "Cannot find module '@/ai/vision/openai-vision-provider'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/vision/openai-vision-provider.ts
/**
 * OpenAI implementation of the domain VisionProvider (RFC-029). Server-side
 * only; lazy `openai` SDK; key from OPENAI_API_KEY. Mirrors GeminiVisionProvider:
 * asks the model for structured JSON garment detections and returns a
 * RawVisionResult. GPT-5 models require `max_completion_tokens` (never
 * `max_tokens`). Empty/garbage output → empty items (a poor read, not an error).
 */

import {
  VisionError,
  type VisionCapabilities,
  type VisionProvider,
  type VisionProviderId,
} from "@/domain/vision";
import type { RawVisionResult, VisionImageInput } from "@/domain/vision";
import { parseVisionItems } from "@/ai/vision/parse-vision-items";

const DEFAULT_VISION_MODEL = "gpt-5.4-mini";
const MAX_COMPLETION_TOKENS = 1024;

const EXTRACTION_PROMPT = [
  "You are a garment detector. Look at the image and list each clothing item, footwear, or accessory you can see.",
  "Return ONLY JSON of the form:",
  '{"items":[{"label":string,"category":string,"colors":[{"name":string,"coveragePct":number}],"material":string|null,"texture":string|null,"pattern":string|null,"brand":string|null,"formality":string|null,"confidence":number}]}',
  "confidence is 0..1. Describe only what is visible; do not invent brands — set brand to null if unsure. No prose, no code fences.",
].join(" ");

type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface OpenAIVisionChatParams {
  model: string;
  messages: { role: string; content: VisionContentPart[] }[];
  max_completion_tokens?: number;
  response_format?: { type: "json_object" | "text" };
}

export interface OpenAIVisionClient {
  chat: {
    completions: {
      create(params: OpenAIVisionChatParams): Promise<{
        choices?: { message?: { content?: string | null } }[];
        model?: string;
        usage?: { total_tokens?: number };
      }>;
    };
  };
}

export interface OpenAIVisionProviderConfig {
  apiKey?: string;
  model?: string;
  client?: OpenAIVisionClient;
}

export class OpenAIVisionProvider implements VisionProvider {
  readonly id: VisionProviderId = "openai";
  readonly capabilities: VisionCapabilities = {
    multiItem: true,
    segmentation: false,
    brandHints: true,
  };

  private readonly config: OpenAIVisionProviderConfig;
  private cachedClient?: OpenAIVisionClient;

  constructor(config: OpenAIVisionProviderConfig = {}) {
    this.config = config;
  }

  async analyze(input: VisionImageInput): Promise<RawVisionResult> {
    if (typeof window !== "undefined") {
      throw new VisionError("provider_error", "OpenAIVisionProvider must run server-side only.");
    }
    const client = await this.getClient();
    const model = this.config.model ?? process.env.OPENAI_MODEL_VISION ?? DEFAULT_VISION_MODEL;

    const url =
      input.kind === "base64" ? `data:${input.mimeType};base64,${input.data}` : input.data;

    let response;
    try {
      response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              { type: "image_url", image_url: { url } },
            ],
          },
        ],
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new VisionError("provider_error", `OpenAI vision request failed: ${message}`, {
        cause: error,
      });
    }

    return {
      provider: this.id,
      model: response.model ?? model,
      items: parseVisionItems(response.choices?.[0]?.message?.content),
      raw: response,
      usage: { totalTokens: response.usage?.total_tokens },
    };
  }

  private async getClient(): Promise<OpenAIVisionClient> {
    if (this.config.client) return this.config.client;
    if (this.cachedClient) return this.cachedClient;
    const apiKey = this.config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new VisionError("provider_error", "OPENAI_API_KEY is not set (server-side only).");
    }
    const { default: OpenAI } = await import("openai");
    this.cachedClient = new OpenAI({ apiKey }) as unknown as OpenAIVisionClient;
    return this.cachedClient;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ai/vision/openai-vision-provider.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/vision/openai-vision-provider.ts src/ai/vision/openai-vision-provider.test.ts
git commit -m "$(printf 'feat(vision): OpenAIVisionProvider (domain VisionProvider impl)\n\nRFC-029. Server-side, lazy openai SDK, image content part, structured\nJSON garment detection. Uses max_completion_tokens.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: FallbackVisionProvider

**Files:**
- Create: `src/ai/vision/fallback-vision-provider.ts`
- Test: `src/ai/vision/fallback-vision-provider.test.ts`

**Interfaces:**
- Consumes: `VisionProvider`, `VisionError` from `@/domain/vision`; `RawVisionResult`, `VisionImageInput` from `@/domain/vision`.
- Produces: `class FallbackVisionProvider implements VisionProvider` with ctor `FallbackVisionProviderConfig { primary: VisionProvider; fallback?: VisionProvider; isFallbackAvailable?: () => boolean }`. `analyze` returns the served provider's `RawVisionResult` (so `raw.provider` already names who served — Task 3's route logs that).

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/vision/fallback-vision-provider.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ai/vision/fallback-vision-provider.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/vision/fallback-vision-provider.ts
/**
 * Vision provider with primary → fallback (RFC-029). Runs the primary; on ANY
 * error, if the fallback is available (key present + budget), runs the fallback.
 * Keeps vision out of the AI Runtime router while giving the Buy-vs-Skip
 * screenshot flow resilience when Gemini is rate-limited. The served provider is
 * named in the returned RawVisionResult.provider, which the /api/ai/vision route
 * logs as ai_usage.
 */

import {
  VisionError,
  type VisionCapabilities,
  type VisionProvider,
  type VisionProviderId,
} from "@/domain/vision";
import type { RawVisionResult, VisionImageInput } from "@/domain/vision";

export interface FallbackVisionProviderConfig {
  primary: VisionProvider;
  fallback?: VisionProvider;
  /** Gate the fallback (e.g. OpenAI budget hard-stop). Defaults to always-available. */
  isFallbackAvailable?: () => boolean;
}

export class FallbackVisionProvider implements VisionProvider {
  readonly id: VisionProviderId;
  readonly capabilities: VisionCapabilities;
  private readonly config: FallbackVisionProviderConfig;

  constructor(config: FallbackVisionProviderConfig) {
    this.config = config;
    this.id = config.primary.id;
    this.capabilities = config.primary.capabilities;
  }

  async analyze(input: VisionImageInput): Promise<RawVisionResult> {
    const { primary, fallback, isFallbackAvailable } = this.config;
    try {
      return await primary.analyze(input);
    } catch (primaryError) {
      const available = isFallbackAvailable ? isFallbackAvailable() : true;
      if (!fallback || !available) throw primaryError;
      try {
        return await fallback.analyze(input);
      } catch (fallbackError) {
        const pMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
        const fMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new VisionError(
          "provider_error",
          `All vision providers failed — ${primary.id}: ${pMsg} | ${fallback.id}: ${fMsg}`,
          { cause: fallbackError },
        );
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ai/vision/fallback-vision-provider.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/vision/fallback-vision-provider.ts src/ai/vision/fallback-vision-provider.test.ts
git commit -m "$(printf 'feat(vision): FallbackVisionProvider (primary -> fallback, gated)\n\nRFC-029. Any-error fallback; skipped when unavailable; combined error\nwhen both fail. Served provider named in RawVisionResult.provider.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 4: Wire the composition root + surface the failure cause in the route

**Files:**
- Modify: `src/ai/vision/vision.server.ts` (whole `getServerVisionProvider` body)
- Modify: `app/api/ai/vision/route.ts:97-108` (add `errorMessage` to the error `logAIUsage`)
- Test: `src/ai/vision/vision.server.test.ts` (create)

**Interfaces:**
- Consumes: `GeminiVisionProvider`, `OpenAIVisionProvider` (Task 2), `FallbackVisionProvider` (Task 3), `getServerAIRuntime` from `@/ai/server/ai-runtime.server` (its `getPolicyResolver().isProviderAvailable("openai")` returns budget-based availability).
- Produces: `getServerVisionProvider(): VisionProvider` now returns a `FallbackVisionProvider` (Gemini primary, OpenAI fallback only when `OPENAI_API_KEY` set). `resetServerVisionProvider()` unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/vision/vision.server.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ai/vision/vision.server.test.ts`
Expected: FAIL — `getServerVisionProvider` returns a `GeminiVisionProvider`, not a `FallbackVisionProvider`.

- [ ] **Step 3: Rewrite the composition root**

Replace the body of `getServerVisionProvider` in `src/ai/vision/vision.server.ts`. New full file:

```ts
/**
 * Server-side vision composition root (RFC-002 / RFC-029). The only place a
 * vision provider meets real credentials; import from route handlers only.
 * Gemini is primary; OpenAI is a budget-gated fallback, wired only when
 * OPENAI_API_KEY is present (so no key ⇒ Gemini-only, unchanged).
 */

import type { VisionProvider } from "@/domain/vision";
import { GeminiVisionProvider } from "@/ai/vision/gemini-vision-provider";
import { OpenAIVisionProvider } from "@/ai/vision/openai-vision-provider";
import { FallbackVisionProvider } from "@/ai/vision/fallback-vision-provider";
import { getServerAIRuntime } from "@/ai/server/ai-runtime.server";

let cached: VisionProvider | undefined;

export function getServerVisionProvider(): VisionProvider {
  if (typeof window !== "undefined") {
    throw new Error("Vision provider is server-side only and must not be imported into client code.");
  }
  if (cached) return cached;

  const primary = new GeminiVisionProvider();
  const fallback = process.env.OPENAI_API_KEY ? new OpenAIVisionProvider() : undefined;

  cached = new FallbackVisionProvider({
    primary,
    fallback,
    // Budget-gated (RFC-014A): same OpenAI availability signal as text routing.
    // Lazy call at analyze-time avoids an eager import cycle.
    isFallbackAvailable: () => getServerAIRuntime().getPolicyResolver().isProviderAvailable("openai"),
  });
  return cached;
}

/** Test/maintenance helper. */
export function resetServerVisionProvider(): void {
  cached = undefined;
}
```

- [ ] **Step 4: Add `errorMessage` to the route's vision error log**

In `app/api/ai/vision/route.ts`, the catch block's `logAIUsage({ … status: "error", errorCode: … })` (around line 97) — add one field so the real cause (e.g. the combined "All vision providers failed — gemini: 429 …") is visible in logs, mirroring the AIRuntime fix:

```ts
    logAIUsage({
      capability: "vision",
      provider: "gemini",
      model,
      promptVersion: "vision-engine",
      cacheHit: false,
      usage: null,
      estimatedCostUsd: null,
      latencyMs: null,
      status: "error",
      errorCode: error instanceof VisionError ? error.code : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/ai/vision/vision.server.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/ai/vision/vision.server.ts src/ai/vision/vision.server.test.ts app/api/ai/vision/route.ts
git commit -m "$(printf 'feat(vision): wire budget-gated OpenAI fallback into vision root\n\nRFC-029. getServerVisionProvider returns FallbackVisionProvider (Gemini\nprimary, OpenAI fallback only when OPENAI_API_KEY set). Route logs the\nreal failure cause via ai_usage errorMessage.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 5: Merge advisor + screenshot into one page

**Files:**
- Modify: `src/features/acquisition/components/ScreenshotAdvisorView.tsx` (ungate the form; retitle)
- Modify: `app/acquisition/advisor/page.tsx` (render the unified view; retitle metadata)
- Modify: `app/acquisition/screenshot/page.tsx` (replace with a server redirect)
- Delete: `src/features/acquisition/components/AcquisitionAdvisorView.tsx`
- Modify (repoint `/acquisition/screenshot` → `/acquisition/advisor`): `src/features/layout/nav-config.ts` (remove the screenshot entry), `src/features/shopping/components/shopping-view.tsx:58`, `src/features/shopping/components/wishlist-view.tsx:165`, `src/features/shopping/components/decision-history-view.tsx:432`, `src/domain/intelligence/ActionGenerator.ts:215`

**Interfaces:**
- Consumes: `ScreenshotAdvisorView` becomes the single advisor component. `AcquisitionAdvisorView` is removed — no other module may import it after this task.
- Produces: `/acquisition/advisor` = unified page; `/acquisition/screenshot` = redirect to it.

- [ ] **Step 1: Read the Next.js redirect/routing docs for this repo**

Run: `ls node_modules/next/dist/docs/ && grep -rl "redirect" node_modules/next/dist/docs/ | head`
Read the relevant page — confirm the App Router server `redirect()` import path and usage for this Next version before editing routes. (AGENTS.md: this Next differs from stock.)

- [ ] **Step 2: Ungate the form in `ScreenshotAdvisorView`**

The prospective-item form (the "2 · Confirm item" card) currently only renders when `candidate != null`. Change it so the form is ALWAYS rendered: when a vision `candidate` exists, prefill it; otherwise render a blank manual form.

Find the form block (currently `candidate ? ( …form card… ) : null`, around line 201–269) and change its outer condition so the card always renders. Inside, make the form props conditional on `candidate`:

```tsx
{/* 2 · Confirm / enter the item — always available (manual works with no image) */}
<Card className="h-fit">
  <CardHeader className="pb-3">
    <CardTitle className="text-base">2 · Confirm the item</CardTitle>
    <CardDescription>
      {candidate
        ? "The Vision Engine's read — correct anything before scoring."
        : "Enter an item manually, or upload a screenshot on the left to prefill this."}
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* keep the existing candidate-only extras (item chips, low-confidence banner)
        INSIDE `candidate ? ( … ) : null` guards — they stay gated on a read. */}
    <ProspectiveItemForm
      key={candidate ? `${candidate.provenance.imageHash}-${selectedIndex}` : "manual"}
      initial={candidate ? candidate.item : undefined}
      lowConfidenceFields={candidate ? candidate.lowConfidenceFields : undefined}
      onAnalyze={runBuyVsSkip}
      isAnalyzing={buyVsSkip.isPending}
    />
  </CardContent>
</Card>
```

Notes for the implementer:
- Keep the multi-item chips block and the `lowConfidence` banner wrapped in their existing `candidate ? (…) : null` / `lowConfidence ? (…) : null` guards — move them ABOVE the `<ProspectiveItemForm>` inside this always-rendered card.
- `runBuyVsSkip` (defined ~line 108) uploads a preview image only when a file is present; with no image it leaves `imagePreviewUrl` undefined — manual path already works. Change its `inputSource` to reflect the path: `buyVsSkip.mutate({ item: withPreview, inputSource: candidate ? "image" : "manual" })`.
- `ProspectiveItemForm`'s `initial` and `lowConfidenceFields` props must accept `undefined` — confirm their types; if they are required, widen to optional in `ProspectiveItemForm` (it already renders a blank form on the advisor today, so it supports no-initial).
- Update the `PageHeader` title from `"Screenshot → Buy vs Skip"` to `"Buy vs Skip Advisor"` and the description to mention both manual entry and optional screenshot upload.

- [ ] **Step 3: Point the advisor route at the unified view**

```tsx
// app/acquisition/advisor/page.tsx
import type { Metadata } from "next";

import { ScreenshotAdvisorView } from "@/features/acquisition/components/ScreenshotAdvisorView";

export const metadata: Metadata = {
  title: "Buy vs Skip Advisor",
};

export default function AcquisitionAdvisorPage() {
  return <ScreenshotAdvisorView />;
}
```

- [ ] **Step 4: Redirect the old screenshot route**

Use the redirect API confirmed in Step 1. Expected shape:

```tsx
// app/acquisition/screenshot/page.tsx
import { redirect } from "next/navigation";

export default function ScreenshotRedirectPage() {
  redirect("/acquisition/advisor");
}
```

- [ ] **Step 5: Delete the now-unused view and repoint references**

```bash
rm src/features/acquisition/components/AcquisitionAdvisorView.tsx
```

Repoint every `/acquisition/screenshot` link to `/acquisition/advisor`:
- `src/features/layout/nav-config.ts` — REMOVE the screenshot nav entry (the object with `href: "/acquisition/screenshot"`, ~line 111–115). Leave the advisor entry.
- `src/features/shopping/components/shopping-view.tsx:58` — `href="/acquisition/screenshot"` → `href="/acquisition/advisor"`.
- `src/features/shopping/components/wishlist-view.tsx:165` — same replacement.
- `src/features/shopping/components/decision-history-view.tsx:432` — same replacement.
- `src/domain/intelligence/ActionGenerator.ts:215` — `href: "/acquisition/screenshot"` → `href: "/acquisition/advisor"` (a data string; domain stays pure).

Verify none remain:

```bash
grep -rn "acquisition/screenshot" src app | grep -v "app/acquisition/screenshot/page.tsx"
```

Expected: no output.

- [ ] **Step 6: Verify — no import of the deleted view, typecheck, full tests, build**

```bash
grep -rn "AcquisitionAdvisorView" src app   # expect: no output
npx tsc --noEmit                             # expect: clean
npm test                                     # expect: all green
npm run build                                # expect: build succeeds (routes compile)
```

- [ ] **Step 7: Verify in the browser (no unit test — node test env)**

Start this session's dev server (`preview_start`), then:
- Visit `/acquisition/advisor` → the item form is visible with no image; fill it → verdict renders.
- Upload a screenshot → form prefills → verdict renders.
- Visit `/acquisition/screenshot` → redirects to `/acquisition/advisor`.
- Confirm the sidebar shows a single advisor entry (no screenshot entry).

Take a screenshot as proof.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(printf 'feat(acquisition): merge screenshot into unified Buy vs Skip advisor\n\nRFC-029. Ungate the form so manual entry works without an image; screenshot\nupload prefills the same form. /acquisition/screenshot redirects to\n/acquisition/advisor. Delete AcquisitionAdvisorView; repoint refs; drop the\nscreenshot nav entry.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Post-implementation

- Update RFC-029 `Status: Draft` → `Implemented` and the BACKLOG row (📝 Draft → ✅ Implemented) once all tasks pass.
- Local vision-fallback testing requires a real `OPENAI_API_KEY` in `.env.local` (blank today).
- Not a release on its own; fold into the next version bump per CLAUDE.md release steps.
