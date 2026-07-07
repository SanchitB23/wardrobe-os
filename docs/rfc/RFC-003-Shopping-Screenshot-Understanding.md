# RFC-003: Shopping Screenshot Understanding

Status: Implemented
Owner: Sanchit Bhatnagar
Author: ChatGPT
Target Release: v0.8.0
Epic: Vision / Acquisition
Priority: Critical
Effort: XL
Dependencies:
- RFC-001 Buy vs Skip (`BuyVsSkipEngine`, `ProspectiveItem`, `analyzeBuyVsSkip`)
- RFC-002 Vision Engine (`VisionEngine`, `VisionAnalysis`, `StyleDNACandidate`, `/api/ai/vision`)
- StyleDNAEngine (`src/domain/style-dna`)
- AI Tool Calling (`src/ai/tools`) — optional future stylist tool
- AI Explanation Layer (`src/ai` — prompt builder + schema + parser + cache, per ADR-004/005/006)

---

## 1. Problem Statement

Wardrobe OS can already (a) evaluate a prospective purchase deterministically via
**Buy vs Skip** (RFC-001) and (b) understand an image via the **Vision Engine**
(RFC-002). But the two are disconnected: to evaluate something seen while
shopping, the user must eyeball a screenshot and **hand-transcribe** it into the
Buy vs Skip form (name, category, colour, material, formality…). That's exactly
the transcription friction the Vision Engine was built to remove.

This RFC connects the two: point the app at a shopping screenshot or product
image and get a pre-filled, editable prospective item — then a deterministic
buy/skip verdict.

## 2. Goals

- Let a user upload **one** shopping screenshot / product image and receive a
  structured, **editable** `ProspectiveItemCandidate`.
- Map `VisionAnalysis` (RFC-002) → `ProspectiveItem` (RFC-001) deterministically
  via a new pure `ShoppingImageInterpreter`.
- Feed the (user-confirmed) `ProspectiveItem` into the unchanged
  `BuyVsSkipEngine` and show the **Buy / Consider / Skip** verdict.
- Offer an **optional** natural-language explanation of the verdict via the
  existing AI explanation layer.
- Keep the boundary intact: **Vision observes, the interpreter maps, the engine
  decides, AI explains.**

## 3. Non-Goals

- **OCR-heavy price extraction** — we do not read the price off the screenshot.
- **Web scraping** — no fetching product pages/URLs.
- **Browser extension** — upload only.
- **Wishlist persistence** — the candidate/verdict are not saved (future Wishlist
  RFC, number TBD).
- **Price tracking** (RFC-005).
- **Multi-product cart analysis** — one primary item per image (others surfaced
  as alternatives, not batch-scored).
- **Payment / credit-card optimization** (RFC-006).

## 4. User Stories

- As the owner, I paste/upload a screenshot of an item I'm considering and get a
  pre-filled candidate, so I don't retype its details.
- As the owner, I **correct** the extracted fields (e.g. category the model got
  wrong, add the price) before analysing, so the verdict is accurate.
- As the owner, I get a deterministic Buy/Consider/Skip verdict for the
  candidate, identical to entering it by hand in the Advisor.
- As the owner, I can optionally ask for a short explanation of the verdict.

## 5. UX Flow

Route: **`/acquisition/screenshot`** (under the Acquisition nav group).

1. **Upload** a shopping screenshot / product image.
2. The Vision Engine runs; the **detected item candidate** is shown, pre-filling
   the prospective-item fields, with low-confidence fields flagged. If multiple
   products are detected, the most prominent is chosen and the others are offered
   as selectable **alternatives**.
3. The user **edits/corrects** any field (category, colour, formality, and —
   always — price, which vision does not extract).
4. The user runs **Buy vs Skip**.
5. The **verdict** renders (reusing RFC-001's `BuyVsSkipResult`).
6. An optional **Explain** button produces a natural-language explanation.

States: uploading/analysing, low-confidence banner (vision `quality` poor/fair →
"double-check the fields"), no-item-detected (fall back to a blank editable
form), and error.

## 6. Architecture

```
Image (upload)
  → VisionEngine (RFC-002, server /api/ai/vision) → VisionAnalysis
  → ShoppingImageInterpreter (pure) → ProspectiveItemCandidate
  → [user edits] → ProspectiveItem
  → BuyVsSkipEngine (RFC-001) → BuyVsSkipAnalysis
  → [optional] AI Explanation (consumes BuyVsSkipAnalysis; never decides)
```

### Domain Layer
- **`ShoppingImageInterpreter`** (`src/domain/acquisition/ShoppingImageInterpreter.ts`,
  pure): `interpretShoppingImage(analysis: VisionAnalysis, options?) →
  ProspectiveItemCandidate`. Deterministic — picks the primary detected item
  (highest confidence / coverage), maps its `StyleDNACandidate` →
  `ProspectiveItem`, records per-field confidence and alternatives. No price
  (vision doesn't extract it) → `estimatedPrice: null`.
- **`ProspectiveItemCandidate`** (`src/domain/acquisition/types.ts` addition): a
  pre-filled, editable `ProspectiveItem` plus extraction confidence/quality,
  per-field confidence, alternative items, and provenance (imageHash, model).
- Reuses `BuyVsSkipEngine` / `ProspectiveItem` (RFC-001) **unchanged**.

### Service Layer
- A screenshot flow that composes existing pieces:
  1. `POST /api/ai/vision` (RFC-002) → `VisionAnalysis` (server-side vision).
  2. `interpretShoppingImage(analysis)` — pure, runs client- or server-side.
  3. `analyzeBuyVsSkip(item)` (RFC-001 service) → `BuyVsSkipAnalysis`.
  No new persistence; reuses existing services/repositories.

### Repository Layer
None. Vision never writes inventory; the candidate/verdict are ephemeral.

### UI Layer
- `/acquisition/screenshot` route + a client view composing: an image uploader
  (reusing RFC-002's `fileToBase64` path), a **candidate editor** (reusing
  RFC-001's `ProspectiveItemForm`, seeded from the candidate, with
  low-confidence field hints + alternative picker), and the verdict
  (`BuyVsSkipResult`).

### AI Layer
- **Optional** explanation only, via the existing AI layer (ADR-004/005/006): a
  buy-vs-skip explanation prompt builder + response schema + parser + cache,
  fed the already-computed `BuyVsSkipAnalysis`. **AI never computes the
  candidate, the mapping, or the verdict.** Vision extraction is the only AI in
  the core path, and it only *observes*.

## 7. Data Flow

```
UI upload → fileToBase64
  → POST /api/ai/vision { imageBase64, mimeType, source: "shopping_screenshot" }
     → VisionEngine (server): preprocess → GeminiVisionProvider → normalize → validate
     → VisionAnalysis
  → interpretShoppingImage(VisionAnalysis)              ← PURE / deterministic
     • pick primary DetectedItem (confidence/coverage)
     • StyleDNACandidate → ProspectiveItem fields
     • per-field confidence + alternatives + provenance
     → ProspectiveItemCandidate
  → user edits fields (esp. price) → ProspectiveItem
  → analyzeBuyVsSkip(item) (RFC-001)                    ← DETERMINISTIC ENGINE
     → BuyVsSkipAnalysis (buy | consider | skip + breakdown)
  → render verdict
  → [optional] Explain → AI explanation of the analysis (no recompute)
```

Only two AI touch-points — vision extraction and the optional explanation — and
neither decides. The interpreter and the engine are pure and deterministic.

## 8. Data Model / Schema Impact

**No database schema changes.** Everything is compute-only and ephemeral: the
candidate and verdict are held in UI state and not persisted (persistence is a
future Wishlist RFC).

## 9. API / Domain Contracts

Reuses `VisionAnalysis` (RFC-002) and `ProspectiveItem` / `BuyVsSkipAnalysis`
(RFC-001). New (illustrative):

```ts
import type { VisionAnalysis, VisionQuality } from "@/domain/vision";
import type { ProspectiveItem } from "@/domain/acquisition";

export interface ProspectiveItemCandidate {
  /** Pre-filled, user-editable. estimatedPrice is null (vision omits price). */
  item: ProspectiveItem;
  /** Overall extraction confidence (from VisionAnalysis). */
  confidence: number;
  quality: VisionQuality;
  /** Per-field extraction confidence (0–1) so the UI can flag weak fields. */
  fieldConfidence: Partial<Record<keyof ProspectiveItem, number>>;
  /** Other detected products the user can switch to (multi-product images). */
  alternatives: ProspectiveItem[];
  provenance: {
    imageHash: string;
    visionProvider: string;
    visionModel: string;
    sourceType: string;
  };
}

/** Pure, deterministic mapping VisionAnalysis → editable candidate. */
export function interpretShoppingImage(
  analysis: VisionAnalysis,
  options?: { preferItemIndex?: number },
): ProspectiveItemCandidate;
```

No changes to `evaluateBuyVsSkip` / `ProspectiveItem` — the interpreter targets
their existing shapes.

## 10. Acceptance Criteria

- [ ] Uploading a screenshot/image produces a `ProspectiveItemCandidate`.
- [ ] The user can edit every candidate field before analysis (price always
      required from the user; vision does not supply it).
- [ ] Multi-product images pick a primary and expose alternatives; the user can
      switch which product is analysed.
- [ ] The confirmed `ProspectiveItem` runs through the **unchanged**
      `BuyVsSkipEngine` and yields the same verdict as manual entry.
- [ ] `BuyVsSkipEngine` remains deterministic; **AI does not decide** the
      candidate, mapping, or verdict.
- [ ] Vision never writes to inventory; nothing is persisted (no wishlist).
- [ ] No database schema changes.

## 11. QA / Testing Plan

Interpreter unit tests (pure, Vitest) — the core:
- **Product-only image** → single high-confidence candidate.
- **Myntra-style screenshot** → primary garment extracted despite UI chrome.
- **Amazon-style screenshot** → primary garment extracted.
- **Low-confidence image** → candidate flagged low quality; fields marked
  low-confidence; never auto-analysed without user confirmation.
- **Multiple visible products** → primary chosen deterministically; others in
  `alternatives`; `preferItemIndex` switches selection.
- **Missing price** → `estimatedPrice` null; downstream Buy vs Skip handles it
  (RFC-001 cost-confidence 0) and the UI prompts for price.
- **Wrong extracted category corrected by user** → the edited `ProspectiveItem`
  (not the raw extraction) drives the verdict.

Plus: `interpretShoppingImage` is deterministic (same `VisionAnalysis` ⇒ same
candidate); integration guard that the produced `ProspectiveItem` is accepted by
`evaluateBuyVsSkip`. Vision provider itself is faked (no model in the suite).

## 12. Risks & Trade-offs

- **Misextraction.** Vision may mislabel category/colour or pick the wrong
  product. *Mitigation:* the candidate is always **editable**; low-confidence
  fields are flagged; the user confirms before analysis (ADR-005 — the model
  proposes, the user/engine dispose).
- **No price from vision.** Cost-efficiency needs a price the screenshot may
  show but we deliberately don't OCR. *Mitigation:* price is a required user
  input; Buy vs Skip already degrades cost confidence gracefully when it's null.
- **Screenshot chrome.** Store UI (buttons, banners) can distract detection.
  *Mitigation:* `source: "shopping_screenshot"` can bias the vision prompt;
  primary-item selection favours the dominant garment.
- **Multi-product ambiguity.** *Mitigation:* deterministic primary + explicit
  alternatives; no silent batch scoring (that's a non-goal).
- **Scope creep** toward scraping/price-tracking/wishlist. *Mitigation:* hard
  non-goals; those are their own RFCs.

## 13. Future Extensions

- **Wishlist (future RFC, number TBD)** — save the candidate + verdict; re-run
  when the wardrobe changes.
- **Price tracking (RFC-005)** — feed a live price into cost-efficiency.
- **Stylist tool** — a `analyzeScreenshot` tool so the chat can accept an image
  (via the tool-calling layer, once multimodal chat exists).
- **URL enrichment / OCR** — optionally read price/brand text (separate
  capability), still user-confirmed.
- **Batch/cart** — evaluate several detected products against a budget.

## 14. Open Questions

1. **Primary-item heuristic** — pick by confidence, by bounding-box area, or a
   blend? What tie-breaker for screenshots where the garment isn't the largest
   region?
2. **Interpreter location** — run `interpretShoppingImage` client-side (pure,
   already have `VisionAnalysis`) or server-side alongside vision? (Leaning
   client — it's pure and avoids a round trip.)
3. **Formality inference** — when vision doesn't return formality, do we infer a
   default from category, or leave null for the user?
4. **Explanation reuse** — introduce a dedicated buy-vs-skip explanation prompt
   builder now, or defer until there are two callers (Advisor + Screenshot)?
5. **Source bias** — should `myntra` / `amazon` / `pinterest` sources send
   provider-specific extraction hints, or keep one generic prompt?
