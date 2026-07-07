# RFC-002: Vision Engine

Status: Implemented
Owner: Sanchit Bhatnagar
Author: ChatGPT
Target Release: v0.8.0
Epic: Vision
Priority: Critical
Effort: XL
Dependencies:
- AI provider abstraction (`src/ai`) — pattern to mirror for the vision provider
- StyleDNA domain (`src/domain/style-dna`) — `StyleDNACandidate` maps toward `StyleDNAItem`
- ADR-004 (vendor-neutral provider abstraction), ADR-005 (AI explains/perceives, never decides)

---

## Vision Philosophy

Three layers, one responsibility each:

- **Vision observes.** The Vision Engine describes what is literally in an image
  — garments, colours, material/pattern cues, brand hints — with confidence. It
  has no opinion about wardrobes, purchases, or outfits.
- **Domain interprets.** The pure domain engines (StyleDNA, Outfit, Health,
  Acquisition, …) turn observations into meaning and decisions — scoring,
  eligibility, ranking. Vision output is an *input* to them, never a verdict.
- **AI explains.** Natural-language narration of already-computed results stays
  in the AI layer.

So: **Vision observes → Domain interprets → AI explains.** This keeps ADR-005
intact even though Vision is AI-assisted — perception is data, not a decision.

## 1. Problem Statement

Wardrobe OS is text-first: every item, outfit, and prospective purchase is
entered by hand. The highest-friction moments — cataloguing a closet, adding a
new purchase, evaluating something seen while shopping — all start from an
**image** the user already has (a photo, a screenshot, a product page). Today
that image is useless to the app; the user must transcribe it into fields.

We repeatedly need the same capability — "look at this image and tell me what
garments are in it, in a structured way" — for many different features
(auto-add, closet scanning, outfit recognition, acquisition, shopping). If each
feature builds its own image handling, we get duplicated, inconsistent, and
provider-locked vision code.

We need **one** universal computer-vision capability that turns any image into a
single, standardized, structured perception result that every other feature can
consume.

## 2. Goals

- Provide **one** capability — the Vision Engine — that produces **one**
  standardized output: **`VisionAnalysis`**. Everything else consumes it.
- **Provider-agnostic**: vision providers (starting with a Gemini vision model)
  live behind an interface; swapping/adding providers is additive (mirrors
  ADR-004).
- **AI-assisted extraction**: a vision model does the perception (detect
  garments, colours, material cues, brand hints).
- **Deterministic normalization**: raw provider output is normalized by pure
  code into the canonical `VisionAnalysis` (stable field names, colour families,
  slots), so downstream engines get consistent, testable data.
- **Structured output** with **confidence scoring** at the field and overall
  level, so consumers can gate on reliability.
- Emit **`StyleDNACandidate`** objects — proposed, partial style profiles that
  map toward `StyleDNAItem` — so the existing deterministic engines can consume
  vision results without change.

**Core principle (ADR-005):** vision **perceives and proposes**; it never
decides. It produces data (candidates + confidence); deterministic engines and
the user still make every scoring/eligibility/inventory decision.

## 3. Non-Goals

Explicitly **out of scope** for the Vision Engine:

- **Shopping** — no product search, price, or buy flows.
- **OCR** — no text extraction from screenshots/labels (a separate capability if
  needed later).
- **Inventory creation** — the engine never writes items; it only returns
  `VisionAnalysis`. (Auto Add Item is a separate consumer RFC.)
- **Recommendations** — no ranking or suggestions.
- **AI chat** — not part of the stylist chat surface.

The Vision Engine is a pure input/perception layer. It has **no product
opinions** — it does not know about wardrobes, purchases, or outfits as
concepts; it only describes images.

## 4. User Stories

The Vision Engine itself is infrastructure; its user value is realised through
future consumers. Stories that motivate its shape:

- As a future **Auto Add** consumer, I want a photo turned into a
  `StyleDNACandidate` (category, colour, material, formality guesses + confidence)
  so I can pre-fill the item form.
- As a future **Closet Scanner** consumer, I want a wardrobe photo turned into
  **multiple** detected items with segmentation, so I can add many at once.
- As a future **Acquisition** consumer, I want a shopping screenshot turned into
  a prospective-item candidate, so Buy vs Skip (RFC-001) can score it.
- As a developer, I want the same `VisionAnalysis` shape regardless of source
  (camera, gallery, Myntra, Amazon, Pinterest, closet, selfie) and provider.

## 5. UX Flow

**RFC-002 ships no end-user UX** — it is a capability, not a screen. The only
surface is an optional **developer test harness** (a "Vision Playground",
analogous to the AI Playground) to submit an image and inspect the raw provider
result, the normalized `VisionAnalysis`, per-field confidence, and the derived
`StyleDNACandidate`s. This is dev/admin-only and not in the primary nav.

End-user experiences (capture/upload flows, review/confirm screens, auto-fill)
belong to the **consumer** RFCs (Auto Add, Closet Scanner, etc.), each of which
takes `VisionAnalysis` and adds its own UX and confirmation step.

## 6. Architecture

```
Image (VisionImageInput)
   ↓
Preprocess             (validate mime/size, normalize orientation, downscale, compute imageHash)
   ↓
Vision Provider        (AI-assisted extraction; provider-agnostic, server-side)
   ↓  RawVisionResult
Vision Normalizer      (pure, deterministic → canonical shapes, colour families, slots, confidence)
   ↓
Validate               (schema-check the normalized output; drop junk/low-signal detections)
   ↓
VisionAnalysis         (the single standardized output)
   ↓
StyleDNACandidate[]    (proposed partial StyleDNA profiles)
   ↓
Future Engines / consumers (Acquisition, Auto Add, Outfit Recognition, Closet Scanner, …)
```

**Processing pipeline** — every analysis runs the same fixed stages:

1. **Preprocess** — validate the input (mime type, size limits), normalize EXIF
   orientation, downscale to a max dimension for cost/latency, and compute a
   stable **`imageHash`** (content hash of the preprocessed bytes) for caching
   and idempotency.
2. **Provider** — the chosen `VisionProvider` runs AI-assisted extraction and
   returns a `RawVisionResult`.
3. **Normalize** — the pure `VisionNormalizer` maps raw output to canonical
   shapes (categories/slots, colour families), derives `StyleDNACandidate`s, and
   computes per-field + overall confidence.
4. **Validate** — the normalized result is schema-validated; malformed or
   below-threshold detections are dropped so consumers always receive a
   well-formed `VisionAnalysis` (or a clear error). Deterministic.

Stages 1, 3, and 4 are pure/deterministic; only stage 2 calls a model.

### Domain Layer
- **`VisionNormalizer`** (`src/domain/vision`, pure): `normalizeVision(raw,
  input, options)` → `VisionAnalysis`. Deterministic — no model calls, no I/O,
  injected `generatedAt`. Maps provider labels → canonical categories/slots
  (reusing StyleDNA slot logic), colour strings → colour families, and computes
  confidence. Builds `StyleDNACandidate`s from detected items.
- **Types** (`src/domain/vision/types.ts`): `VisionSource`, `VisionImageInput`,
  `RawVisionResult`, `DetectedItem`, `ColorObservation`, `Segmentation`,
  `StyleDNACandidate`, `VisionAnalysis`.

### Service Layer
_(Design only; built when a consumer needs it.)_ A server-side vision service
composes the provider + normalizer: `analyzeImage(input) → { data, error }`.
Server-side only (like the AI layer) — provider keys never reach the browser.

### Repository Layer
None required for the engine. Reads of item images (if analysing existing
photos) reuse existing storage/repositories. No new persistence in RFC-002.

### UI Layer
Only the optional dev Vision Playground (see §5). No production UI.

### AI Layer
- **`VisionProvider`** interface (vendor-neutral), mirroring `AIProvider`
  (ADR-004): `analyze(input: VisionImageInput): Promise<RawVisionResult>` plus a
  `capabilities` descriptor (multi-item detection, segmentation, brand hints).
- A **GeminiVisionProvider** implementation (server-side, lazy SDK, key from
  env); OpenAI/other providers are future stubs. Selected via config, like
  `AI_PROVIDER`.
- The provider does **AI-assisted extraction only**. It returns raw perception;
  it makes no product decision. All normalization is deterministic and lives in
  the domain layer.

**Provider capability comparison** (illustrative planning matrix — capabilities
are self-reported by each provider's `capabilities` descriptor; the normalizer
degrades gracefully when a capability is absent):

| Provider | Multi-item detect | Segmentation | Brand hints | Native colours | Notes |
| --- | --- | --- | --- | --- | --- |
| Gemini vision (first target) | ✅ | ▲ boxes | ▲ low-conf | ✅ | Lead implementation; strong general tagging |
| OpenAI GPT-4o vision | ✅ | ▲ boxes | ▲ low-conf | ✅ | Candidate fallback |
| Anthropic Claude vision | ✅ | ✕ | ▲ low-conf | ✅ | Candidate fallback |
| Dedicated CV / segmentation model | ✅ | ✅ masks | ✕ | ▲ | Future, for precise closet segmentation |

Legend: ✅ supported · ▲ partial/low-confidence · ✕ not supported. Segmentation
baseline is a bounding box; polygon/mask is opportunistic per
`capabilities.segmentation`.

## 7. Data Flow

```
consumer → visionService.analyzeImage(input)                { data, error }
  → VisionProvider.analyze(input)                            (AI vision model, server-side)
      raw detections: labels, boxes/masks, colours, material/pattern cues, brand guesses, confidences
  → VisionNormalizer.normalizeVision(raw, input, { generatedAt })   ← PURE / deterministic
      • canonicalise category → slot (StyleDNA slot logic)
      • colour strings → { name, family, hex? } observations
      • aggregate dominant colours, material, texture, pattern
      • derive StyleDNACandidate per detected item (+ confidence)
      • compute per-field + overall confidence
  → VisionAnalysis
  → consumer maps StyleDNACandidate → its own flow (form pre-fill, ProspectiveItem, etc.)
```

The provider step is non-deterministic (a model); the normalizer step is fully
deterministic and unit-tested. Consumers only ever see `VisionAnalysis`.

## 8. Data Model / Schema Impact

**No database schema changes in RFC-002.** The engine is compute-only;
`VisionAnalysis` is returned to callers, not persisted.

Future (separate RFCs, noted for planning only): an optional additive
`vision_cache` table (image hash → `VisionAnalysis`, TTL) mirroring the AI
response cache (ADR-006), to avoid re-analysing the same image. Documented then,
not now.

## 9. API / Domain Contracts

Illustrative (final names settled at implementation). Confidence is 0–1.

```ts
export type VisionSource =
  | "camera" | "gallery" | "shopping_screenshot"
  | "myntra" | "amazon" | "pinterest"
  | "closet_photo" | "outfit_selfie"
  | (string & {});

export interface VisionImageInput {
  kind: "url" | "base64";
  data: string;
  mimeType: string;
  source: VisionSource;
}

/** Vendor-neutral provider (mirrors AIProvider). Server-side only. */
export interface VisionProvider {
  readonly id: string;
  readonly capabilities: {
    multiItem: boolean;
    segmentation: boolean;
    brandHints: boolean;
  };
  analyze(input: VisionImageInput): Promise<RawVisionResult>;
}

export interface ColorObservation {
  name: string | null;
  family: string | null;
  hex: string | null;
  coveragePct: number | null;
  confidence: number;
}

export interface Segmentation {
  boundingBox?: { x: number; y: number; width: number; height: number };
  /** Optional polygon/mask when the provider supports it. */
  polygon?: { x: number; y: number }[] | null;
}

export interface StyleDNACandidate {
  name: string | null;
  category: string | null;
  subcategory: string | null;
  slot: string | null;
  color: string | null;
  colorFamily: string | null;
  material: string | null;
  texture: string | null;
  pattern: string | null;
  formality: string | null;
  styleTags: string[];
  brandGuess: string | null;
  confidence: number;
}

export interface DetectedItem {
  label: string;
  category: string | null;
  slot: string | null;
  colors: ColorObservation[];
  material: string | null;
  texture: string | null;
  pattern: string | null;
  brandGuess: string | null;
  segmentation: Segmentation | null;
  styleDNACandidate: StyleDNACandidate;
  confidence: number;
}

/** Raw, provider-shaped result (pre-normalization). Opaque to consumers. */
export interface RawVisionResult {
  provider: string;
  model: string;
  items: unknown[];        // provider-specific
  raw?: unknown;
  usage?: { totalTokens?: number };
}

/** Human-friendly band derived deterministically from numeric confidence. */
export type VisionQuality = "poor" | "fair" | "good" | "excellent";

/** THE standardized output. Everything downstream consumes this. */
export interface VisionAnalysis {
  sourceType: VisionSource;
  detectedItems: DetectedItem[];
  dominantColors: ColorObservation[];
  /** Aggregate cues (most useful for single-item images). */
  material: string | null;
  texture: string | null;
  pattern: string | null;
  brand: string | null;
  styleDNACandidates: StyleDNACandidate[];
  /** 0–1 overall confidence. */
  confidence: number;
  /** Band derived from `confidence` (see thresholds below). */
  quality: VisionQuality;
  segmentation: Segmentation[] | null;
  metadata: {
    engineVersion: string;
    provider: string;
    model: string;
    generatedAt: string;
    latencyMs: number | null;
    sourceType: VisionSource;
    /** Stable content hash of the preprocessed image (caching / idempotency). */
    imageHash: string;
    /**
     * RESERVED — FUTURE USE ONLY. A vector embedding of the image/detected
     * items for similarity search (e.g. "find items like this"). Not populated
     * in this RFC; declared so the shape is forward-compatible.
     */
    embeddings?: number[] | null;
  };
}
```

**Confidence → quality bands** (deterministic, computed in Normalize):

| Quality | Overall confidence |
| --- | --- |
| `poor` | `< 0.40` |
| `fair` | `0.40 – 0.64` |
| `good` | `0.65 – 0.84` |
| `excellent` | `≥ 0.85` |

Both the numeric `confidence` and the `quality` band are returned, so consumers
can gate precisely or display a friendly label.

export function normalizeVision(
  raw: RawVisionResult,
  input: VisionImageInput,
  options?: { generatedAt?: string },
): VisionAnalysis;
```

## 10. Acceptance Criteria

RFC is Approved-ready when it defines (it does):

- [ ] A single standardized output contract (`VisionAnalysis`) — including
      `confidence` + derived `quality` band, `metadata.imageHash`, and the
      reserved (future-only) `metadata.embeddings` — and the `VisionProvider` +
      `VisionNormalizer` boundary.
- [ ] The fixed processing pipeline: Preprocess → Provider → Normalize →
      Validate → `VisionAnalysis`.
- [ ] Provider-agnostic design (interface + capability comparison + at least one
      planned implementation).
- [ ] Deterministic normalization mapping (labels→slots, colours→families,
      confidence).
- [ ] `StyleDNACandidate` shape that maps toward `StyleDNAItem`.
- [ ] The supported `VisionSource` set.
- [ ] Explicit non-goals (no shopping/OCR/inventory/recommendations/chat).
- [ ] Testing plan, risks, and future extensions.

Implementation-time criteria (future PR, not this RFC):
- [ ] `normalizeVision` is pure and deterministic (same raw + input ⇒ same output).
- [ ] Every `VisionAnalysis` field populated; confidence in [0,1].
- [ ] Provider stub throws a NotImplemented-style error until wired.
- [ ] Vision never writes to the DB and never calls recommendation/scoring code.

## 11. QA / Testing Plan

- **Normalizer unit tests (pure, Vitest)** — the core:
  - label → category/slot canonicalization (incl. unknown → fallback).
  - colour string → `{ name, family, hex? }`; dominant-colour aggregation.
  - `StyleDNACandidate` derivation from a detected item.
  - per-field + overall confidence computation (incl. low-signal inputs).
  - `confidence` → `quality` band mapping at each threshold boundary
    (0.39/0.40, 0.64/0.65, 0.84/0.85).
  - determinism (same raw + `generatedAt` ⇒ identical `VisionAnalysis`).
  - multi-item vs single-item raw results.
- **Preprocess/imageHash** — the same image bytes produce a stable `imageHash`;
  differing images produce different hashes (caching/idempotency guard).
- **Provider** — fake `VisionProvider` returning canned `RawVisionResult` to
  exercise the service without a network/model; real provider tested manually.
- **Contract** — a `StyleDNACandidate` fed into `deriveStyleDNA`-adjacent code
  produces a valid profile (integration guard with the StyleDNA domain).
- No model calls in the automated suite.

## 12. Risks & Trade-offs

- **Hallucination / wrong labels.** Vision models misread garments, colours, and
  especially brands. *Mitigation:* confidence on every field; brand is a
  low-confidence *guess*, never authoritative; consumers require human
  confirmation (ADR-005 — vision proposes, engines/users dispose).
- **Provider variance.** Different providers return different shapes/quality.
  *Mitigation:* the deterministic normalizer is the single smoothing point.
- **Cost & latency.** Vision calls are pricier/slower than text. *Mitigation:*
  provider-agnostic + a future `vision_cache` (image-hash keyed).
- **Segmentation fidelity.** Masks may be coarse/absent. *Mitigation:*
  `capabilities.segmentation`; bounding box as the baseline, polygon optional.
- **Privacy.** Selfies/closet photos are sensitive. *Mitigation:* server-side
  only, no long-term storage in RFC-002; a retention policy accompanies any
  future cache.
- **Scope creep** toward OCR/shopping/inventory. *Mitigation:* hard non-goals;
  those are consumer RFCs.

## 13. Future Extensions

`VisionAnalysis` is designed to be consumed by (each its own RFC):
- **Acquisition Engine** — shopping screenshot → `ProspectiveItem` for Buy vs Skip.
- **Auto Add Item** — photo → pre-filled item form.
- **Outfit Recognition** — outfit selfie → detected items → outfit scoring.
- **Closet Scanner** — batch wardrobe photos → many detected items.
- **Laundry** — detect worn/soiled state (later).
- **Shopping** — product-page ingestion.

Plus: a `vision_cache` (ADR-006-style), OCR as a sibling capability, and
on-device/edge inference.

## 14. Open Questions

1. **First provider** — confirm Gemini vision as the initial `VisionProvider`;
   any fallback?
2. **Segmentation representation** — bounding box only in v1, or polygons/masks
   where available?
3. **Colour → hex** — do we ask the model for hex, or map colour names to hex via
   a deterministic table (reuse the app's colour map)?
4. **Single vs multi-item** — should `source` bias the provider prompt (e.g.
   product screenshot ⇒ expect one item; closet photo ⇒ expect many)?
5. **Caching** — cache `VisionAnalysis` by image hash from day one, or defer?
6. **Confidence surfacing** — numeric confidence vs low/medium/high bands for
   consumers.
