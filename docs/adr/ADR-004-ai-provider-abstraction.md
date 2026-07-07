# ADR-004: Vendor-neutral AI provider abstraction

- **Status:** Accepted
- **Date:** 2026-07-07
- **Related:** [ADR-005](ADR-005-ai-does-not-decide.md), [ADR-006](ADR-006-ai-cache.md)

## Context

We want to add LLM-backed features (starting with explanations) without binding
the codebase to one vendor's SDK. Provider SDKs differ in request/response
shapes, streaming, structured output, and error semantics; committing to one
leaks its types across the app and makes switching or adding a fallback a
rewrite. We also need every AI call to run **server-side** so API keys never
reach the browser, and we want the plumbing testable without a network or key.

## Decision

Build a **vendor-neutral AI layer** under `src/ai/` whose contracts every part
of the app depends on — never a concrete SDK:

- **`AIProvider`** — `generate()` / `stream()` / `vision()` over vendor-neutral
  `AIRequest` / `AIResponse`, plus a `capabilities` descriptor.
- **`AIService`** — the façade the app calls, implemented by an
  **`AIOrchestrator`** responsible for provider selection, retry with backoff,
  cross-provider fallback, structured logging, and cache (ADR-006).
- **`PromptBuilder`** (provider-independent), **`ResponseParser` / `ResponseSchema`**
  for validated structured output, **`AICache`**, and an error taxonomy
  (`AIError`, `NotImplementedError`, `ProviderError`, `ParseError`).
- **Providers:** `GeminiProvider` is implemented on `@google/genai`;
  `OpenAIProvider` and `ClaudeProvider` are stubs that throw
  `NotImplementedError`. `AIProviderId` is an open union so new providers need no
  type edits.
- **Server-only composition root** (`src/ai/server/ai-service.server.ts`) is the
  only place a provider meets real credentials. `GEMINI_API_KEY` has no
  `NEXT_PUBLIC_` prefix (never bundled), plus a runtime `window` guard; the
  backend is chosen via `AI_PROVIDER`. Calls happen inside Node route handlers.
- The SDK is imported lazily and the client is injectable, so unit tests run
  with a fake client — no network, no key.

## Consequences

- Features depend on `AIService`, so swapping Gemini for another provider (or
  adding a fallback chain) is a change in the composition root only.
- Keys stay server-side by construction; the layer is fully unit-tested against
  fakes.
- Cost: an abstraction layer over the SDK and a mapping step per provider. Worth
  it for portability and testability; the surface is small.
- Capabilities are declared per provider, so the orchestrator can route (e.g.
  vision) and fail cleanly when a capability is missing.

## Alternatives considered

- **Call a provider SDK directly from routes/services.** Least code today, but
  leaks vendor types everywhere and makes switching/fallback a rewrite; harder
  to test. Rejected.
- **Adopt a third-party multi-provider framework.** Extra dependency and its own
  abstractions/opinions; more than a hobby project needs, and still a lock-in of
  a different kind. Rejected in favour of a thin in-repo contract.
- **Client-side calls with a public key.** Exposes the key and cost surface to
  the browser. Rejected outright.
