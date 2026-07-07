# AI Infrastructure Layer

Vendor-neutral scaffolding that prepares Wardrobe OS for multiple LLM providers.

**Status:** the **Gemini** provider is implemented (`generate()` via
`@google/genai`); OpenAI and Claude remain stubs that throw
`NotImplementedError`. No AI product features exist yet — only plumbing plus a
debug route. Everything speaks the vendor-neutral contracts in `types/`, so
swapping or adding providers is additive, not a rewrite.

## Environment

Server-side only — never prefix with `NEXT_PUBLIC_`, never commit a real key.
See `.env.example`.

| Var | Purpose | Default |
| --- | --- | --- |
| `AI_PROVIDER` | Which backend `getServerAIService()` uses | `gemini` |
| `GEMINI_API_KEY` | Gemini API key (required to call Gemini) | — |
| `GEMINI_MODEL` | Model id | `gemini-2.5-flash` (low cost) |

## Server boundary & debug route

- `src/ai/server/ai-service.server.ts` is the **composition root** — the only
  place a provider is wired to real credentials. Import it from route handlers /
  server code only, never from client components. It memoizes an `AIService`
  and disables orchestrator-level retry (the provider retries once itself), so
  call volume stays predictable.
- `GET /api/ai/test` ([app/api/ai/test/route.ts](../../app/api/ai/test/route.ts))
  runs the full path (orchestrator → GeminiProvider → SDK) and returns a small
  validated JSON object. Node runtime, non-cached. Use it to confirm wiring.

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
`vision` throw `NotImplementedError`. `GeminiProvider` is the worked example:

- Install the SDK (Gemini uses `@google/genai`).
- **Read the API key from an env var at call time. Never hardcode a key and
  never commit one.** Import the SDK lazily so it never lands in a client bundle.
- Override the methods to map `AIRequest` → the SDK's request and the SDK's
  response → `AIResponse` (`responseFormat: "json"` → the SDK's JSON mode).
- Accept an injectable client in the constructor so unit tests need no network.
- Keep `capabilities` honest — the orchestrator routes on it. Gemini declares
  `generate` + `structuredOutput` only; `stream`/`vision` stay stubbed.

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
