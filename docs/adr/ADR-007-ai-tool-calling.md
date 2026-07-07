# ADR-007: AI tool-calling architecture

- **Status:** Accepted
- **Date:** 2026-07-07
- **Related:** [ADR-004](ADR-004-ai-provider-abstraction.md), [ADR-005](ADR-005-ai-does-not-decide.md)

## Context

The AI stylist needs live wardrobe data — recommendations, health, usage,
outfits, items, shopping gaps — to answer usefully. The naive approach is to
stuff that data into the prompt or let the model "query" it. Both are bad: they
leak large payloads, can't stay fresh, and blur the line ADR-005 draws (AI must
not be the source of truth or reach the database). We want the model to *act*
through the same service layer everything else uses, with validated inputs, and
without binding to one provider's function-calling format.

## Decision

Introduce a provider-neutral **tool-calling layer** in `src/ai/tools` and route
all AI data access through it:

```
AI model → ToolRouter → ToolExecutor → AITool → feature service → repository → Supabase
```

- **`AITool`** — a named capability with a JSON-schema `parameters` and an
  `execute` that calls a **feature service** (never a repository or Supabase
  directly).
- **`ToolRegistry`** — holds the tools and emits their declarations in
  provider-neutral form plus **Gemini function-declaration** and **OpenAI tool**
  shapes.
- **`ToolExecutor`** — validates the model's args against the tool schema, runs
  the tool, and always returns a structured `ToolResult` (`unknown_tool` /
  `invalid_args` / `execution_error`) — it never throws to the model.
- **`ToolRouter`** — routes one or many calls (concurrent, order-preserving,
  failure-isolated).
- **Eight wardrobe tools** back recommendations, health, usage, insights,
  outfit, item, inventory search, and shopping advice. `ChatModel` /
  `GeminiChatModel` drive the streaming chat loop that calls the router.

The model receives only tool declarations; it emits tool calls; the layer
executes them. The AI never queries the database.

## Consequences

- Reinforces ADR-005: the model can only reach data the way the app does, and
  tools return already-computed engine output — the model can't recompute or
  fabricate it.
- Provider-independent: the registry adapts to Gemini today and OpenAI later
  with no change to the tools themselves.
- Safe by construction: schema validation rejects bad args before execution;
  errors are structured results the model can react to, not crashes.
- Testable: tools take injectable services, so the whole loop is unit-tested
  without a network.
- Cost: an extra layer and per-tool schema to maintain, and multi-step tool
  loops cost more tokens/latency than a single call — bounded by a max-step cap.

## Alternatives considered

- **Stuff data into the prompt.** Large, stale, expensive, and pushes the model
  toward "deciding" from raw data. Rejected.
- **Let the model query Supabase (text-to-SQL / direct client).** Violates
  ADR-005 and the layering, and is a security/cost risk. Rejected outright.
- **Bind directly to Gemini function calling.** Fast, but leaks the vendor format
  across the app and blocks OpenAI later. Rejected in favour of a neutral
  registry with adapters.
