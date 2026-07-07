# Changelog

All notable changes to Wardrobe OS are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [0.6.0] — 2026-07-07

**AI Stylist Beta.** The deterministic wardrobe stack gains an AI layer that
explains and converses — without ever becoming the source of truth.

### Added

- **AI infrastructure** — a vendor-neutral AI layer (`AIProvider`, `AIService`,
  orchestrator with provider selection, retry, fallback, logging) and prompt /
  schema / parser primitives.
- **Gemini provider** — server-side `generate()` on `@google/genai`, key read
  from env (never bundled to the browser), retry-once on transient failures.
- **AI recommendation explanation** — an ✨ Explain action on recommendation
  cards that produces a validated, structured explanation grounded only in the
  already-computed recommendation and curated summaries.
- **AI response cache** — Supabase-backed `ai_cache` with in-memory fallback,
  deterministic key (prompt builder + version + model + input), TTL expiry,
  `forceRefresh`, and cached/fresh visibility.
- **AI Playground** (`/ai/playground`) — a developer tool to run prompt builders
  in isolation and inspect prompts, response, validation, latency, and cache.
- **AI tool-calling architecture** — `ToolRegistry` / `ToolExecutor` /
  `ToolRouter` with JSON-schema validation and Gemini/OpenAI adapters, plus 8
  wardrobe tools (recommendations, health, usage, insights, outfit, item,
  inventory search, shopping advice).
- **AI Stylist Chat** (`/chat`) — a streaming, tool-calling stylist with
  session-only memory, suggested prompts, a Debug mode showing every tool call,
  and latency + token-usage display.
- **Architecture Decision Records** — ADR-001 … ADR-008 under `docs/adr/`.

### Changed

- `GeminiProvider` / `GeminiChatModel` now honour a per-request `model`, so the
  model used matches the AI cache key.

### Notes

- No database schema changes beyond the additive `ai_cache` table (RLS-enabled,
  anon policy consistent with the rest of the app).
- AI remains explanation/conversation only — all scoring, eligibility, ranking,
  health, and cost decisions stay in the pure domain engines.

## [0.5.0]

- Outfit Generation Engine and Unified Recommendation Engine; Recommendation
  Center with debug tooling.

## [0.4.0]

- Outfit Builder and the deterministic Outfit Scoring Engine.

## [0.3.0]

- Dashboard analytics, Wardrobe Health Engine, Usage Analytics Engine,
  Purchase / cost-per-wear tracking, and the Insight Center.

## [0.2.0]

- Image upload, bulk JSON import, item detail pages, advanced inventory table.

## [0.1.0]

- Database schema and inventory CRUD.

[Unreleased]: https://github.com/SanchitB23/wardrobe-os/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/SanchitB23/wardrobe-os/releases/tag/v0.6.0
