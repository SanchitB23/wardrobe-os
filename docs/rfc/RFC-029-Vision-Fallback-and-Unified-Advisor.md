# RFC-029: Vision Fallback + Unified Buy-vs-Skip Advisor

Status: Draft
Owner: Sanchit Bhatnagar
Author: Claude (Opus 4.8)
Target Release: v2.5.0 (tentative)
Epic: Acquisition / AI Runtime
Priority: Medium
Effort: M
Dependencies:
- RFC-001 (Buy vs Skip Engine)
- RFC-002 (Vision Engine — `VisionProvider`, `analyzeImage`)
- RFC-003 (Shopping Screenshot Understanding)
- RFC-014A (OpenAI provider, model policy, OpenAI budget guard)
- RFC-022 (Logging & Observability — `ai_usage`, `errorMessage`)

---

## 1. Problem Statement

Two related pain points in the acquisition flow:

1. **Vision has no fallback.** The Vision Engine (`src/ai/vision/vision.server.ts`)
   talks to Gemini directly through the domain `VisionProvider` interface and
   **bypasses the AI Runtime router entirely** — so it has no primary→fallback
   machinery. When Gemini errors (today: free-tier `429 RESOURCE_EXHAUSTED`, but
   also 5xx / timeouts / empty reads), the **Screenshot → Buy vs Skip** flow
   fails outright with no second provider to cover. OpenAI is not an option: its
   provider declares `vision: false` and no `OpenAIVisionProvider` exists.

2. **Two near-duplicate pages.** `/acquisition/advisor` (manual entry) and
   `/acquisition/screenshot` (image → vision → prefill) both funnel into the same
   `useBuyVsSkip` → `BuyVsSkipResult`. The screenshot page is *almost* a superset
   of the advisor, except its `ProspectiveItemForm` is gated behind a vision
   `candidate`, so it cannot be used for manual entry. Users see two entries for
   what is really one feature with two input modes.

## 2. Goals

- Add an **OpenAI vision fallback** so a Gemini vision failure degrades to OpenAI
  instead of failing the flow — keeping the RFC-002 vision composition root
  (no dependency on the AI Runtime router).
- Fall back on **any** Gemini vision error (429, 5xx, timeout, empty read).
- **Budget-gate** the fallback: skip OpenAI when its budget hard-stop is tripped,
  consistent with text routing (RFC-014A). OpenAI vision spend is observable via
  `ai_usage`.
- **Merge** the advisor and screenshot pages into a single `/acquisition/advisor`
  with the form always visible (manual) and an optional screenshot upload that
  prefills it.
- Keep all deterministic behaviour unchanged: engines decide, AI only reads the
  image (ADR-005).

## 3. Non-Goals

- **Not** routing vision through the AI Runtime `ProviderRouter` (deliberate —
  domain `VisionProvider` ≠ runtime `AIProvider`; that bridge is a future RFC).
- **Not** changing Buy-vs-Skip scoring, the `VisionAnalysis` shape, or the
  `analyzeImage` normalization pipeline.
- **Not** adding OpenAI image *generation* (`gpt-image-2`) — input vision only.
- **Not** changing Gemini's quota/billing (out of scope; the fallback is the
  mitigation).
- **Not** adding Claude as a third vision provider (future extension).

## 4. User Stories

- As a shopper, when I upload a screenshot and Gemini is rate-limited, I still get
  a Buy-vs-Skip verdict because OpenAI reads the image instead.
- As a shopper, I have **one** advisor page: I can type an item in manually, or
  drop a screenshot to prefill it — same verdict either way.
- As the operator, I can see in the logs which provider served a vision call and
  whether it was a fallback, and the exact cause when both fail.

## 5. UX Flow

Single page at `/acquisition/advisor`:

1. **Prospective item form is always visible** (manual entry works with no image).
2. **Optional**: choose a source + upload a screenshot → "Analyze image" runs the
   Vision Engine → the form is **prefilled** from the read (with low-confidence
   fields flagged). User can edit before running.
3. **Analyze** → `useBuyVsSkip` → deterministic verdict in `BuyVsSkipResult`
   (+ optional AI explanation, unchanged).
4. `/acquisition/screenshot` performs a server `redirect()` to
   `/acquisition/advisor` (bookmarks preserved). Its nav entry is removed.

## 6. Architecture

Feature-first; only the AI and UI layers change. Domain stays pure.

### Domain Layer
No changes. `VisionProvider` interface, `analyzeImage(provider, …)` pipeline, and
`BuyVsSkipEngine` are untouched. The new providers implement the existing
`VisionProvider` contract.

### Service Layer
No new service. `screenshot.client.ts` (calls `/api/ai/vision`) is unchanged.

### Repository Layer
No changes. No new persistence.

### UI Layer
- Promote `ScreenshotAdvisorView` to the single advisor view: **ungate**
  `ProspectiveItemForm` so it renders blank when there is no vision `candidate`
  (manual path), and prefills when a `candidate` exists.
- Delete `AcquisitionAdvisorView` (its always-visible-form behaviour is absorbed).
- `app/acquisition/advisor/page.tsx` renders the unified view; retitle.
- `app/acquisition/screenshot/page.tsx` → `redirect("/acquisition/advisor")`.
- Repoint all references (nav-config, shopping-view, wishlist-view,
  decision-history-view, acquisitions-landing-view, today-view,
  ReplacementOpportunitiesList, `ActionGenerator`) to `/acquisition/advisor`.
- Remove the screenshot nav entry from `nav-config.ts`.

### AI Layer
- **`OpenAIVisionProvider implements VisionProvider`** (`src/ai/vision/`):
  server-side only, lazy `openai` import, image sent as an image content part
  (base64 data URL) via chat completions, `max_completion_tokens` (never
  `max_tokens` — see RFC-014A follow-up), model from
  `OPENAI_MODEL_VISION ?? "gpt-5.4-mini"`. Returns the raw shape `analyzeImage`
  already normalizes; throws `VisionError` on empty/missing-key.
- **`FallbackVisionProvider implements VisionProvider`** (`src/ai/vision/`):
  wraps `[gemini, openai?]`. Runs Gemini; on **any** error, if OpenAI is
  available (`OPENAI_API_KEY` present **and** budget not hard-stopped via an
  injected `isOpenAIAvailable()`), runs OpenAI. If OpenAI is gated or also fails,
  it rethrows so the failure surfaces. Emits `ai_usage` per served call
  (`provider`, `usedFallback`), and `errorMessage` on failure.
- **`vision.server.ts`**: `getServerVisionProvider()` returns a
  `FallbackVisionProvider`. The OpenAI arm is included only when `OPENAI_API_KEY`
  is set → **no OpenAI key ⇒ Gemini-only, unchanged behaviour** (local dev safe).
- Determinism unchanged: AI reads the image into a `VisionAnalysis`; the
  `BuyVsSkipEngine` decides (ADR-005).

## 7. Data Flow

```
Upload screenshot
  → screenshot.client.analyzeScreenshot() → POST /api/ai/vision
    → getServerVisionProvider() = FallbackVisionProvider([Gemini, OpenAI?])
        → Gemini.analyze(image)
            ├─ ok  → VisionAnalysis
            └─ error → isOpenAIAvailable()?
                         ├─ yes → OpenAI.analyze(image) → VisionAnalysis (usedFallback)
                         └─ no  → throw (surface)
    → analyzeImage() normalize + validate → VisionAnalysis
  → interpretShoppingImage() → prefilled ProspectiveItem (form)
User edits → runBuyVsSkip → useBuyVsSkip → BuyVsSkipEngine (deterministic) → BuyVsSkipResult
```

Manual path skips the vision leg entirely: blank form → same
`useBuyVsSkip` → verdict.

## 8. Data Model / Schema Impact

**No schema changes.** No new tables, columns, or RLS policies.

## 9. API / Domain Contracts

- No change to `/api/ai/vision` request/response contract or `VisionAnalysis`.
- New classes (both implement existing `VisionProvider`):
  - `class OpenAIVisionProvider implements VisionProvider`
  - `class FallbackVisionProvider implements VisionProvider` — ctor takes
    `{ primary: VisionProvider; fallback?: VisionProvider; isOpenAIAvailable?: () => boolean }`.
- New env var: `OPENAI_MODEL_VISION` (optional; code default `gpt-5.4-mini`).
- UI: `AcquisitionAdvisorView` removed; `ScreenshotAdvisorView` becomes the
  unified advisor (may be renamed, e.g. `BuyVsSkipAdvisorView`).

## 10. Acceptance Criteria

- [ ] `/acquisition/advisor` shows the prospective-item form immediately (no image
      required) and produces a verdict from manual entry.
- [ ] Uploading a screenshot on the same page prefills the form and produces a
      verdict.
- [ ] `/acquisition/screenshot` redirects to `/acquisition/advisor`.
- [ ] No remaining references or nav entries point to `/acquisition/screenshot`.
- [ ] When Gemini vision fails and OpenAI is available, the vision call is served
      by OpenAI (`ai_usage` shows `provider: "openai"`, `usedFallback: true`).
- [ ] When Gemini vision fails and OpenAI budget is hard-stopped (or no key), the
      call fails and surfaces (no OpenAI spend).
- [ ] With no `OPENAI_API_KEY`, behaviour is identical to today (Gemini-only).
- [ ] On total vision failure, `ai_usage` `errorMessage` carries the per-provider
      cause.
- [ ] `npm test` green; `tsc --noEmit` clean.

## 11. QA / Testing Plan

Unit (Vitest):
- `OpenAIVisionProvider`: maps image → chat params with `max_completion_tokens`;
  parses a normal result; throws on empty content; throws on missing key.
- `FallbackVisionProvider`: (a) Gemini ok → Gemini, no fallback; (b) Gemini throws
  + OpenAI available → OpenAI, `usedFallback`; (c) Gemini throws + OpenAI gated by
  budget → throws, OpenAI never called; (d) Gemini throws + no OpenAI arm →
  throws.
- UI: advisor renders the form with no image (manual path) and calls
  `useBuyVsSkip` on submit.
- Redirect: `/acquisition/screenshot` → `/acquisition/advisor`.

Manual / preview:
- Screenshot upload with a valid Gemini key (happy path).
- Force a Gemini failure (e.g. exhausted quota) with an OpenAI key set → confirm
  OpenAI serves and the verdict still renders.

## 12. Risks & Trade-offs

- **Fall back on *any* error** (chosen) can send a genuinely bad image (e.g.
  unreadable) to OpenAI too, costing a second call before failing. Trade-off
  accepted: the live pain is Gemini quota, and resilience is the priority; the
  budget gate caps worst-case spend.
- **Reasoning-model empty output**: GPT-5 models spend output budget on reasoning;
  too small a token cap yields empty content. Vision uses its own (larger) budget,
  not the probe's; still verified by the empty-response test.
- **`gpt-5.4-mini` vision support** is assumed from OpenAI docs (GPT-5 family is
  multimodal) but not verified against this account. Mitigated by
  `OPENAI_MODEL_VISION` being env-swappable.
- **Divergent fallback logic**: vision fallback is a second, smaller
  implementation separate from the runtime `ProviderRouter`. Accepted to preserve
  the RFC-002 separation; unifying is a future extension.

## 13. Future Extensions

- Bridge the domain vision pipeline onto the AI Runtime `ProviderRouter` so vision
  reuses one routing/budget/observability path (`vision: { primary, fallback }`).
- Add Claude as a third vision provider.
- Per-source model tuning (e.g. a stronger model for dense retailer screenshots).

## 14. Open Questions

- Confirm which GPT-5.x model this OpenAI account may use for image input, to set
  the `OPENAI_MODEL_VISION` default with confidence (does not block the design —
  env-driven).
