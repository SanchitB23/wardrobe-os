# AI Infrastructure Layer

Vendor-neutral scaffolding that prepares Wardrobe OS for multiple LLM providers.

**What this layer is not (yet):** there is no provider SDK, no API key, no
network call, no React, and no database here. Every provider is a stub that
throws `NotImplementedError`. This is pure architecture — the contracts,
orchestration, prompt-building, structured-output parsing, and caching are all
in place so that wiring a real provider later is an additive change, not a
rewrite.

## Layout

```
src/ai/
  types/            Core contracts (AIProvider, AIRequest, AIResponse, AIService, …) + error taxonomy
  providers/        Stub providers: Gemini, OpenAI, Claude (extend StubAIProvider)
  prompt-builders/  PromptBuilder — turns a PromptContext into a BuiltPrompt (provider-independent)
  schemas/          ResponseSchema + JSON ResponseParser (validates structured output)
  cache/            AICache implementations (InMemoryAICache, noopCache)
  orchestrator/     AIOrchestrator — provider selection, retry, fallback, logging, cache
```

## The flow

1. A **PromptBuilder** turns a task-shaped `PromptContext` into a `BuiltPrompt`
   (`system` + `prompt` + optional `schema`). It knows nothing about providers.
2. The caller wraps that into an `AIRequest` and calls the **AIOrchestrator**
   (`AIService`).
3. The **orchestrator** selects a capable provider, retries with backoff, falls
   back to the next provider on failure, logs each step, and reads/writes the
   **cache** on `generate()`.
4. A **ResponseParser** (built from a `ResponseSchema`) extracts and validates
   structured output into `response.parsed`.

Every dependency points at an interface in `types/`, never at a concrete
provider — so features depend on `AIService`, not on Gemini/OpenAI/Claude.

## Extension points

### 1. Implement a real provider
`providers/*-provider.ts` extend `StubAIProvider`, whose `generate`/`stream`/
`vision` throw `NotImplementedError`. To make one real:

- Install the SDK (e.g. `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`).
- **Read the API key from an env var at call time. Never hardcode a key and
  never commit one.**
- Override `generate`/`stream`/`vision` to map `AIRequest` → the SDK's request
  and the SDK's response → `AIResponse`.
- Keep `capabilities` honest — the orchestrator routes on it.

### 2. Add a new provider
Create a class extending `StubAIProvider` with a new `id`, export it from
`providers/index.ts`, and register it with the orchestrator. `AIProviderId` is
an open union (`… | (string & {})`), so no type edit is required.

### 3. Add a prompt builder
Use `createPromptBuilder({ id, schema, render })`. Attach a `ResponseSchema` to
get automatic JSON-instruction injection and downstream validation. See
`prompt-builders/example-outfit-prompt-builder.ts`.

### 4. Add / swap a schema validator
`schemas/response-schema.ts` ships a dependency-free `objectSchema` factory. To
adopt Zod/Valibot later, wrap it in `defineResponseSchema` and delegate
`validate` to the library's `safeParse`.

### 5. Swap the cache or logger
Implement `AICache` (e.g. Redis, a Supabase table, edge KV) or `AILogger` and
pass it to `createAIOrchestrator`. Nothing else changes.

### 6. Tune retry / fallback
Pass a `RetryPolicy` and `providerOrder` to `createAIOrchestrator`. Injecting
`sleep` lets tests exercise backoff without real delays.

## Example wiring (once a provider is real)

```ts
import {
  createAIOrchestrator,
  ClaudeProvider,
  GeminiProvider,
  createJsonResponseParser,
  outfitSuggestionPromptBuilder,
} from "@/ai";

const ai = createAIOrchestrator({
  providers: [new ClaudeProvider(), new GeminiProvider()], // order = preference
});

const built = outfitSuggestionPromptBuilder.build({
  task: "outfit-suggestion",
  data: { items: [/* … */] },
  now: "2026-07-07",
});

const res = await ai.generate(
  { prompt: built.prompt, system: built.system },
  { parser: createJsonResponseParser(built.schema!), cacheKey: "outfit:today" },
);

res.parsed; // OutfitSuggestion, validated
```
