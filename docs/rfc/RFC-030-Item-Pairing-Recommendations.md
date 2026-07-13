# RFC-030: Item Pairing Recommendations — "What Goes With This?"

Status: Approved
Owner: Sanchit Bhatnagar
Author: Claude (Fable 5)
Target Release: v2.6.0 (tentative)
Epic: Item Pairing & Styling
Priority: Medium
Effort: M
Dependencies:
- RFC-012 (Recommendation Engine v2 — outfit compatibility primitives)
- RFC-001 (Buy vs Skip Engine — `scoreOutfitCompatibility` pattern being adapted)
- RFC-005 (Intelligence Orchestrator — `pairing` capability registration)
- ADR-005 (AI does not decide)
- ADR-007 (AI tool calling)
- StyleDNA (`src/domain/style-dna/StyleDNAEngine.ts`)
- Outfit engine (`src/domain/outfit/outfit-engine.ts` → `evaluateOutfit`)

---

## 1. Problem Statement

Every recommendation surface today is **context-anchored**: "what should I wear
for this occasion/weather?" There is no way to ask the inverse, item-anchored
question: **"I want to wear my black T-shirt — which pants and shoes go with
it?"**

The pain is visible in three places:

1. The item detail page ships three **"Coming soon"** placeholder cards
   (`src/features/inventory/components/item-detail-view.tsx`):
   *Compatibility* ("How well this item pairs with the rest of your wardrobe"),
   *AI recommendation* ("Smart styling suggestions for this piece"), and
   *Outfits* ("Saved outfits that feature this item"). All three are promises
   this RFC exists to keep.
2. The AI Stylist chat cannot answer "what goes with my black tee?" in an
   ADR-005-compliant way: it can fetch the item (`getItem`) and candidates
   (`searchInventory`), but no tool exposes deterministic pairing scores, so any
   answer would be the model *inventing* a compatibility judgment — exactly what
   ADR-005 forbids.
3. The capability already half-exists, pointed the wrong way:
   `BuyVsSkipEngine.scoreOutfitCompatibility`
   (`src/domain/acquisition/BuyVsSkipEngine.ts`) anchors on a **prospective**
   (not-yet-owned) item, picks top-K owned items per complementary core slot,
   builds a bounded cartesian product of candidate outfits, and scores each with
   `evaluateOutfit`. Nothing equivalent exists for an **owned** item.

All the deterministic building blocks (color, formality, texture, season,
occasion engines composed by `evaluateOutfit`; per-item StyleDNA) are pure
domain code today — they are just never surfaced as "given item X, what pairs
with it?"

## 2. Goals

- A **deterministic Item Pairing Engine** (pure domain) that, given an owned
  anchor item and the active wardrobe, returns:
  - ranked **complementary items per outfit slot** (e.g. for a top: best
    bottoms, best footwear), each with a score and human-readable reasons;
  - top-N **complete anchored outfits** (anchor + one item per remaining core
    slot), scored via `evaluateOutfit`.
- Replace the item detail page's three placeholder cards with live sections:
  **Compatibility** (pairings + anchored outfits), **Outfits** (saved outfits
  featuring this item), and a chat hand-off for styling questions.
- A new AI tool **`getItemPairings`** so the Stylist chat can answer "what goes
  with my black T-shirt?" by narrating engine output — never by deciding.
- Register pairing as an Intelligence Orchestrator **`pairing` capability**
  (RFC-005) so `runIntelligence` can compose it with other capabilities.
- Deterministic output: same wardrobe in → same pairings out (stable
  tie-breaking, no randomness, time injected if ever needed).

## 3. Non-Goals

- **No changes to RFC-012 recommendation ranking** — the v2 engine, its
  scoring dimensions, and `RecommendationContext` are untouched (no
  `anchorItemId` added to the context; item pairing is a separate engine).
- **No changes to Buy vs Skip** — `scoreOutfitCompatibility` stays as-is for
  prospective items; this RFC adapts the pattern, it does not refactor RFC-001.
- **No AI-generated compatibility judgments** — AI narrates deterministic
  scores only (ADR-005). No LLM call is required to render the Compatibility
  section.
- **No optional-slot pairing suggestions in v1** — watch, belt, fragrance, and
  accessory suggestions are future extensions; v1 suggests complements for the
  core slots (top / bottom / footwear). **Outerwear anchors are in scope**: an
  outerwear item builds top+bottom+footwear around itself (same `CORE_SLOTS`
  exclusion behaviour as Buy vs Skip), but outerwear is not *suggested* as a
  complement in v1.
- **No "save this anchored outfit" one-click flow** in v1 (future extension;
  the outfit builder already exists for manual saving).
- **No schema changes** — pairing is computed on demand, not persisted.
- **No weather/occasion conditioning of pairings** in v1 — pairing answers
  "what goes together", not "what should I wear today" (that is RFC-012's job).

## 4. User Stories

- As the wardrobe owner, I open my black T-shirt's detail page and see which of
  my pants and shoes pair best with it, with scores and reasons, so I can dress
  around a piece I already decided to wear.
- As the wardrobe owner, I see my best complete outfits built around this item,
  so I get a ready-made answer instead of assembling one mentally.
- As the wardrobe owner, I see which of my saved outfits already feature this
  item, so I can reuse combinations I've already curated.
- As the wardrobe owner, I ask the AI Stylist "what goes well with my black
  T-shirt?" and get a conversational answer grounded in the same deterministic
  scores shown on the item page — not a hallucinated opinion.
- As the wardrobe owner, when an item has too few complementary items (e.g. no
  footwear in the wardrobe), I see an honest empty state, not a fabricated
  pairing.

## 5. UX Flow

**Entry point 1 — item detail page** (`/inventory/[id]`):

1. The three `ComingSoonCard`s are replaced by live sections:
   - **Compatibility card**: for each complementary core slot, the top ~3
     pairings ("Bottoms: Charcoal Chinos 8.2/10 — neutral pairing, matching
     formality"), followed by the top ~3 **anchored outfits** with overall
     scores. Scores are shown **numerically** (`8.2/10`), consistent with Buy
     vs Skip's `PotentialOutfits`. A compact "why" line per entry surfaces
     engine reasons.
   - **Outfits card**: saved outfits that contain this item (name, occasion,
     score if available), linking to the outfit detail.
   - **Stylist card**: replaces "AI recommendation" — a link into the Stylist
     chat pre-seeded with "What goes well with my <item name>?" so the
     conversational layer handles free-form styling questions. No inline LLM
     call on the item page in v1.
2. Loading and empty states: skeleton while computing; if a needed slot has no
   active items, the Compatibility card says so plainly ("Add footwear to see
   complete outfit suggestions") instead of guessing.
3. Anchor item must be **active** wardrobe; archived/retired items show the
   Compatibility card in a disabled state.

**Entry point 2 — AI Stylist chat**:

1. User asks "what goes with my black T-shirt?" (or "which shoes for my blue
   jeans?").
2. Model resolves the item (via `searchInventory` if the user gave a name, or
   directly if an id is in context), then calls **`getItemPairings`**.
3. Model narrates the deterministic result: best pairings per slot, best
   anchored outfits, and the engine's reasons — following the existing pattern
   of `getRecommendations`/`getShoppingAdvice` (engine decides, AI explains).

## 6. Architecture

Feature-first; pairing computation is pure domain, orchestration lives in a
service, the item page and the AI tool are two thin consumers of the same
service.

### Domain Layer

New module `src/domain/pairing/`:

- `ItemPairingEngine.ts` — pure, deterministic. Core algorithm (adapted from
  `BuyVsSkipEngine.scoreOutfitCompatibility`, re-anchored on an owned item):
  1. Map every active wardrobe item to its `OutfitSlot` via existing
     StyleDNA / `slot-matching` logic; exclude the anchor itself.
  2. For each complementary core slot (`CORE_SLOTS` minus the anchor's slot),
     take top-K candidates (rating-desc, name-asc tie-break — same
     deterministic ordering as Buy vs Skip).
  3. Build a bounded cartesian product of anchored outfit candidates
     (anchor + one item per remaining core slot), score each with
     `evaluateOutfit`, cap candidate count.
  4. Derive **per-item pairing scores** from the outfit candidates: an item's
     pairing score = the best `overallScore` among candidate outfits it
     appears in (so pairings and outfits can never contradict each other).
     Reasons come from the outfit analysis breakdown (color / formality /
     texture engine results).
  5. Return a versioned `ItemPairingReport` with explainability codes
     (`PAIRING_STRONG`, `PAIRING_WEAK`, `SLOT_EMPTY`, `ANCHOR_INACTIVE`, …).
- `assumptions.ts` — tunables (top-K per slot, max candidates, max returned
  pairings/outfits, strong/weak thresholds), mirroring the acquisition
  module's `OUTFIT_COMPAT` constants.
- Reuses (no changes): `evaluateOutfit`, `styleDNAEngine`, slot matching,
  and the color/formality/texture/season/occasion engines.

### Service Layer

- `src/features/inventory/services/item-pairing.service.ts` —
  `getItemPairings(itemId)`: fetch anchor item + active wardrobe via existing
  inventory repository, derive StyleDNA per item, call `ItemPairingEngine`,
  return `{ data: ItemPairingReport, error }`. No AI involvement.
- `src/features/outfits/services/outfits.service.ts` — add
  `listOutfitsContainingItem(itemId)` passthrough for the Outfits card.

### Repository Layer

- No new tables. One new read in
  `src/features/outfits/repositories/outfits.repository.ts`:
  `listByItemId(itemId)` — saved outfits whose outfit-items include the item
  (existing outfit/outfit-items tables; existing RLS/anon policies already
  cover SELECT on these tables — verify with the RLS auditor, no policy
  changes expected).

### UI Layer

- `src/features/inventory/components/item-compatibility-card.tsx` — pairings
  per slot + anchored outfits (replaces `ComingSoonCard` "Compatibility").
- `src/features/inventory/components/item-outfits-card.tsx` — saved outfits
  featuring the item (replaces `ComingSoonCard` "Outfits").
- Stylist hand-off card replacing "AI recommendation" (link with pre-seeded
  prompt; no new AI surface on this page).
- `src/features/inventory/hooks/use-item-pairings.ts` and
  `use-item-outfits.ts` — React Query hooks over the services. Components stay
  logic-free.

### AI Layer

- New tool in `src/ai/tools/wardrobe/index.ts`: **`getItemPairings`**
  (params: `itemId`; description tells the model to resolve names via
  `searchInventory` first). Executes the same
  `item-pairing.service.getItemPairings` and returns the report verbatim.
- The model **narrates** scores, reasons, and outfit candidates. System prompt
  guidance (existing ADR-005 phrasing) already prohibits it from re-ranking or
  inventing pairings; the tool description restates it.
- **Intelligence Orchestrator registration (RFC-005)**: add `"pairing"` to
  `CapabilityId`, register it in `CapabilityRegistry` (executor calls the same
  pairing service; consumer supplies `inputs.itemId`), so `runIntelligence`
  can compose pairing with other capabilities (e.g. pairing + usage for
  "wear-this-more" narratives). Requests without `itemId` fail the capability
  with a clear error — the orchestrator never guesses an anchor.
- No prompt-builder changes beyond registering the tool.

## 7. Data Flow

**Item page:**

1. `item-detail-view.tsx` renders → `useItemPairings(itemId)` /
   `useItemOutfits(itemId)`.
2. Hooks call `item-pairing.service.getItemPairings` /
   `outfits.service.listOutfitsContainingItem`.
3. Services fetch via repositories (inventory items + relations; outfits by
   item id) — the only Supabase touchpoints.
4. Service maps rows → domain types, derives StyleDNA per item (pure), calls
   `ItemPairingEngine.buildPairingReport(anchor, wardrobe)` (pure).
5. `{ data, error }` flows back; components render report or empty state.

**Chat:**

1. User asks a pairing question → model calls `searchInventory` (name → id)
   → calls `getItemPairings({ itemId })`.
2. Tool executor invokes the same service (step 3–5 above) and returns the
   `ItemPairingReport` as tool output.
3. Model composes a conversational answer strictly from the report.

## 8. Data Model / Schema Impact

**No schema changes.** Pairing reports are computed on demand and not
persisted. The only new data access is a read-path query over existing outfit
tables (outfits ⋈ outfit items filtered by item id), covered by existing anon
SELECT policies.

## 9. API / Domain Contracts

```ts
// src/domain/pairing/ItemPairingEngine.ts (pure)
export interface PairingCandidate {
  itemId: string;
  itemName: string;
  slot: OutfitSlot;
  score: number;            // 0–10, best anchored-outfit score featuring this item
  reasons: string[];        // from OutfitAnalysis breakdown (color/formality/texture)
}

export interface AnchoredOutfit {
  itemIds: string[];        // complementary items (anchor excluded, like PotentialOutfit)
  itemNames: string[];      // anchor first, then complements
  score: number;            // evaluateOutfit overallScore, 1 decimal
}

export interface ItemPairingReport {
  version: string;                       // engine version for observability
  anchorItemId: string;
  anchorSlot: OutfitSlot;
  pairingsBySlot: Record<OutfitSlot, PairingCandidate[]>; // complementary core slots only
  outfits: AnchoredOutfit[];             // top-N, score-desc, deterministic ties
  codes: PairingExplainabilityCode[];    // PAIRING_STRONG | PAIRING_WEAK | SLOT_EMPTY | ANCHOR_INACTIVE
}

export function buildPairingReport(
  anchor: { item: StyleDNAItem; dna: StyleDNA },
  wardrobe: ReadonlyArray<{ item: StyleDNAItem; dna: StyleDNA }>,
  config?: Partial<ItemPairingConfig>,
): ItemPairingReport;

// src/features/inventory/services/item-pairing.service.ts
export async function getItemPairings(
  itemId: string,
): Promise<{ data: ItemPairingReport | null; error: string | null }>;

// src/features/outfits/services/outfits.service.ts
export async function listOutfitsContainingItem(
  itemId: string,
): Promise<{ data: OutfitSummary[] | null; error: string | null }>;

// src/ai/tools/wardrobe/index.ts — new tool schema
// name: "getItemPairings"
// params: { itemId: string }
// returns: ItemPairingReport (verbatim; model narrates, never re-ranks)

// src/domain/orchestrator/Capability.ts — additive changes (RFC-005)
export type CapabilityId =
  | /* existing ids */ "pairing";

export interface CapabilityInputs {
  /* existing fields */
  /** For `pairing` — the owned anchor item to pair around. Required. */
  itemId?: string;
}
```

## 10. Acceptance Criteria

- [ ] Item detail page shows a live **Compatibility** section for an active
      item with at least one item in every complementary core slot: top
      pairings per slot (score + reasons) and top anchored outfits.
- [ ] Same wardrobe state → identical report on every run (deterministic
      ordering, stable tie-breaks) — verified by a unit test running the
      engine twice.
- [ ] Pairing scores are consistent with anchored outfits: every displayed
      pairing score equals the best displayed/computed outfit score featuring
      that item.
- [ ] When a complementary slot has no active items, the section shows an
      explicit empty state and the report carries `SLOT_EMPTY`; no outfits are
      fabricated.
- [ ] Archived/retired anchor items do not compute pairings (disabled state,
      `ANCHOR_INACTIVE`).
- [ ] **Outfits** card lists exactly the saved outfits containing the item,
      and links to them; empty state when none.
- [ ] "Coming soon" placeholders for Compatibility and Outfits are gone; the
      third card links to the Stylist with a pre-seeded pairing prompt.
- [ ] AI Stylist answers "what goes with <item>?" by calling
      `getItemPairings` (visible in tool-call logs), and every score/pairing it
      states appears in the tool output.
- [ ] Asking the Stylist about a nonexistent item yields a graceful "couldn't
      find it" answer, not an invented pairing.
- [ ] Outerwear anchors work: an outerwear item's Compatibility card builds
      top+bottom+footwear outfits around it.
- [ ] `runIntelligence` accepts `capabilities: ["pairing"]` with
      `inputs.itemId` and returns the same report the item page shows; a
      pairing request without `itemId` fails with a clear capability error.
- [ ] Scores render numerically (`x.x/10`) on the Compatibility card.
- [ ] `npm test` green; no component imports Supabase or the engine directly.

## 11. QA / Testing Plan

**Unit (Vitest, domain — required per repo rule 10):**

- Engine: anchor slot exclusion; top-K selection order (rating desc, name asc);
  candidate cap respected; per-item score = max participating outfit score;
  determinism (two runs, deep-equal); `SLOT_EMPTY` when a slot is missing;
  `ANCHOR_INACTIVE` handling; config overrides (top-K, max returned);
  outerwear anchor builds all three core slots around itself.
- Orchestrator: `pairing` capability registered, runs with `inputs.itemId`,
  fails cleanly without it; existing capability graph tests stay green.
- Reasons: report entries carry non-empty reasons derived from
  `OutfitAnalysis` breakdown for at least color and formality engines.

**Service/integration:**

- `item-pairing.service` maps repository rows → StyleDNA inputs correctly and
  returns `{ data, error }` on repo failure (no throw).
- `listOutfitsContainingItem` returns only outfits containing the item
  (fixture with overlapping outfits).
- AI tool: schema validation, executor returns the report, unknown `itemId`
  returns a tool-level error the model can relay.

**Manual/preview:**

- Item with full wardrobe coverage → sensible pairings (spot-check against the
  outfit builder's `evaluateOutfit` scores).
- Item in a near-empty wardrobe → empty states.
- Chat: "what goes with my black T-shirt?" end-to-end with
  `gemini-2.5-flash-lite` during development (per repo testing note), flipped
  back to `gemini-2.5-flash` before handoff.
- RLS audit pass (supabase-rls-auditor) on the new outfits read path.

## 12. Risks & Trade-offs

- **Combinatorial cost on large wardrobes.** Bounded exactly as Buy vs Skip
  bounds it: top-K per slot + hard candidate cap. Trade-off: the true best
  pairing could sit outside top-K (low ratings but great color match). Accepted
  for v1; K is a tunable in `assumptions.ts`.
- **Pairing quality is only as good as `evaluateOutfit`.** Color/formality/
  texture heuristics can feel naive ("everything goes with black"). Mitigated
  by surfacing reasons so weak logic is visible and tunable; improving the
  underlying engines is out of scope.
- **Score-derivation choice.** Deriving per-item scores from anchored-outfit
  scores (rather than a standalone pairwise metric) guarantees UI consistency
  but couples pairing rankings to third-item effects. Chosen deliberately: a
  pairing you can't complete into a good outfit is not a useful pairing.
- **Latency on the item page.** Full-wardrobe fetch + DNA derivation + scoring
  per page view. Wardrobe sizes here are small (hundreds, not thousands);
  React Query caching amortises repeat views. No persistence layer added until
  proven necessary.
- **Chat item resolution.** The model must map "black T-shirt" → an id via
  `searchInventory`; ambiguous matches risk pairing the wrong item. Tool
  description instructs the model to confirm when multiple candidates match.

## 13. Future Extensions

- **Optional-slot pairing suggestions**: outerwear-as-complement, belt, watch,
  fragrance, accessory suggestions per anchor (outerwear *anchors* are already
  in v1 scope).
- **"Save as outfit"** one-click from an anchored outfit (feeds RFC-023's
  promotion surface).
- **Context-conditioned pairing**: intersect pairings with today's weather/
  occasion (compose with RFC-012 context instead of duplicating it).
- **Inline AI styling blurb** on the item page (budget-gated, narrating the
  same report — the full "AI recommendation" card promise).
- **Outfit builder assist**: after picking a top in the manual builder, rank
  the bottom/footwear pickers by pairing score instead of plain search order.
- **Pairing-aware shopping**: "this prospective item pairs with N of your
  items" is already Buy vs Skip; the inverse ("you own nothing that pairs with
  this — skip") could reuse this engine's report shape.

## 14. Open Questions

None — all resolved with the owner (2026-07-13):

1. **Score display** — numeric (`8.2/10`), matching Buy vs Skip's
   `PotentialOutfits`; no qualitative tiers.
2. **Tunables** — separate `src/domain/pairing/assumptions.ts`, seeded with Buy
   vs Skip's `OUTFIT_COMPAT` values; tuned independently thereafter.
3. **Orchestrator** — `pairing` **is** registered as an Intelligence
   Orchestrator capability in v1 (in addition to the standalone
   `getItemPairings` chat tool).
4. **Outerwear anchors** — in scope for v1: an outerwear anchor builds
   top+bottom+footwear around itself via `CORE_SLOTS` exclusion, same as Buy vs
   Skip. Outerwear as a *suggested complement* remains a future extension.
