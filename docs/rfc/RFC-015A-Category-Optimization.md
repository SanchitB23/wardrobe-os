# RFC-015A: Category Optimization

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Cursor (Grok)
Target Release: v2.x
Epic: Intelligence Center
Priority: Medium
Effort: M
Dependencies:
- RFC-015 Intelligence Center (`src/domain/intelligence`, `/intelligence`) — `Replace` action cards this RFC makes actionable; Center remains the aggregator/ranker, not a new verdict engine
- RFC-018 Shopping Intelligence (`src/domain/shopping`, `/acquisitions`) — consumes optimization opportunities into the wishlist / priority queue
- RFC-018B Acquisitions Intelligence — opportunity queue / strategy may later absorb optimization-driven suggestions (consume, do not duplicate)
- RFC-001 Acquisition Engine / Buy vs Skip — replacement candidates are evaluated here; Category Optimization does not decide buy/skip
- RFC-012 Recommendation Engine v2 — outfit coverage + recommendation frequency signals for item comparison
- RFC-004 / RFC-013 Personalization — taste / explore-exploit context for rotate vs explore framing
- WardrobeHealthEngine, UsageAnalyticsEngine, ROIEngine (`src/domain/shopping/ROIEngine.ts`) — category score inputs
- StyleDNA (`src/domain/style-dna`) + optional Visual Similarity (RFC-019/020) — comparison dimensions
- Inventory (`wardrobe_items`, wear logs, purchases, images) — the category subject set
- ADR-005 (AI does not decide), ADR-002 (RecommendationContext), ADR-006 (caching)

> **Letter-suffix evolution of RFC-015** (same pattern as RFC-014B / RFC-018B).
> The Intelligence Center already surfaces typed `Replace` actions from health
> (duplicates / worn-out). Those cards are informative but often dead-ends —
> especially category-level duplicates, which today have **no `href`**. This RFC
> turns `Replace` into a guided **Category Optimization** workflow: analyse the
> category, compare similar items, produce a deterministic keep/rotate/retire
> plan, and feed shopping suggestions — without auto-deleting or auto-retiring
> anything.

> **Core philosophy:** Wardrobe OS should **optimize a wardrobe over time**. It
> should not simply recommend replacing items.

---

## Category Optimization Philosophy

Same separation as RFC-015 / RFC-018, applied to *category stewardship*:

- **Engines decide signals.** Health, usage, ROI, StyleDNA, recommendation, and
  acquisition already produce the facts (counts, wears, duplicates, gaps, CPW).
- **Category Optimization plans.** A new pure domain layer turns those signals
  into a **Category Analysis**, **Item Comparison**, and **Optimization Plan**
  (Keep / Protect / Rotate / Retire / Ignore / Move to Wishlist / Analyze
  Replacement) — deterministic, explainable, and reversible by the user.
- **Shopping Intelligence executes suggestions.** Replacement opportunities become
  wishlist / priority-queue inputs (RFC-018); Buy vs Skip still decides each
  prospective purchase (RFC-001).
- **AI explains.** Optional narration of the plan; never invents keep/retire
  counts or shopping picks (ADR-005).
- **No destructive automation.** Retire / delete / donate / sell are never
  applied automatically. The plan recommends; the user executes via existing
  inventory / acquisitions flows.

So:

```
Intelligence Center (Replace card)
  → Optimize Category
  → Category Analysis
  → Compare Similar Items
  → Optimization Plan
  → Shopping Suggestions (→ RFC-018)
  → User Execution (inventory status / wishlist / Buy vs Skip)
```

---

## 1. Problem Statement

The Intelligence Center (RFC-015) leads with prioritised actions. Among them,
**`Replace`** is mapped from wardrobe health:

- **Worn-out items** → `replace` with `subject.kind: "item"` (no deep link today).
- **Near-duplicate clusters** → `replace` with `subject.kind: "category"` (also no
  `href` today — the card is read-only).

These cards correctly *flag* a problem ("several near-duplicate white casual
tops") but leave the owner stranded:

- **Informative, not actionable.** Clicking often does nothing; there is no
  guided next step.
- **"Replace" is the wrong mental model.** Over-represented categories usually
  need **optimization** — keep the high-ROI pieces, rotate the mid ones, retire
  only the low-use duplicates — not a single swap.
- **No category-level workspace.** Health, usage, ROI, and StyleDNA each touch
  categories, but nothing composes them into one **Category Analysis** with ideal
  vs current counts, coverage, and a score.
- **No structured comparison.** Owners cannot see wear count, cost-per-wear, ROI,
  outfit coverage, recommendation frequency, StyleDNA, and visual similarity
  side-by-side for peers in a category.
- **Shopping is disconnected.** Gap/`Buy` cards link to the advisor; duplicate
  `Replace` cards do not feed Shopping Intelligence with concrete replacement
  opportunities derived from a plan.

We need a **Category Optimization** workflow that opens from Intelligence Center
`Replace` cards, produces a deterministic optimization plan, and integrates
shopping suggestions — while remaining non-destructive and AI-safe.

## 2. Goals

- Transform Intelligence Center **`Replace`** cards into an entry point for
  **Optimize Category** (category- or item-scoped → resolve to a category).
- Provide a **Category Analysis** surface: current vs ideal count, usage
  distribution, wardrobe health, ROI, coverage, and a **Category Score**.
- Provide **Item Comparison** across similar items in the category with the
  metrics listed in §5.
- Produce a deterministic **Optimization Plan** with Keep / Protect / Rotate /
  Retire / Ignore assignments plus **Replacement Opportunities**.
- Estimate **wardrobe health improvement** and **expected ROI improvement** from
  the plan (deterministic projections, clearly labelled as estimates).
- Integrate with **Shopping Intelligence (RFC-018)** so suggested purchases
  originate from optimization opportunities (wishlist / queue inputs), not a
  parallel shopping brain.
- Preserve ADR-005: engines decide signals; this RFC plans; AI only explains;
  **no automatic retirement, deletion, donation, or selling**.

## 3. Non-Goals

Explicitly out of scope:

- **Donation workflow**
- **Selling workflow**
- **Marketplace integration**
- **Automatic retirement** (status flips without user confirmation)
- **Automatic deletion** of inventory items
- A new purchase **verdict** engine (Buy vs Skip remains RFC-001)
- Replacing or rewriting Shopping Intelligence ranking (RFC-018) or Acquisitions
  learning (RFC-018B) — this RFC **feeds** them opportunities
- Notifications / scheduling / background jobs
- Multi-user collaboration

## 4. User Stories

- As the owner, I tap a **Replace** card on `/intelligence` and enter **Optimize
  Category** instead of reading a dead-end tip.
- As the owner, I see **how crowded** a category is (current vs ideal), how those
  items are used, and a single **Category Score**.
- As the owner, I **compare similar items** on wear count, CPW, ROI, outfit
  coverage, recommendation frequency, StyleDNA, and visual similarity.
- As the owner, I get a clear plan: e.g. keep 2, rotate 2, retire 2 — with named
  replacement opportunities — and I choose what to execute.
- As the owner, suggested replacements appear in **Acquisitions / Shopping** so I
  can run Buy vs Skip before buying.
- As the owner, **nothing is retired or deleted** unless I act through existing
  inventory flows.
- As a developer, the plan is a pure function of wardrobe + analytics inputs and
  is unit-testable with golden fixtures.

## 5. UX Flow

### Entry

1. **Intelligence Center** (`/intelligence`) — `Replace` cards (and optionally
   high-severity duplicate / over-density health signals) gain an actionable
   deep link, e.g. `/intelligence/optimize?category=<slug>` or
   `/intelligence/optimize/[categoryKey]`.
2. Item-scoped worn-out `Replace` cards resolve to that item's **category** (or
   open comparison focused on the item within its category).

### Workflow (primary)

```
Intelligence Center
        ↓
Optimize Category
        ↓
Category Analysis
        ↓
Compare Similar Items
        ↓
Optimization Plan
        ↓
Shopping Suggestions
        ↓
Execution (user-driven)
```

### Screens / states

1. **Category Analysis** — summary metrics (§Category Analysis below). Empty /
   cold states when the category has &lt; 2 comparable items or sparse wear data
   (show low confidence, still allow comparison).
2. **Item Comparison** — table or card grid of peer items with metrics; user may
   pin/focus an item (e.g. the worn-out subject).
3. **Optimization Plan** — deterministic Keep / Protect / Rotate / Retire /
   Ignore buckets with counts and item lists; Replacement Opportunities;
   estimated health + ROI deltas.
4. **Shopping Suggestions** — opportunities linked into Acquisitions: "Add to
   wishlist", "Analyze with Buy vs Skip", open screenshot advisor with a
   category-shaped prompt (optional). No auto-insert without confirmation.
5. **Execution** — CTAs only:
   - Keep / Protect / Rotate / Ignore → soft labels / notes (no forced writes in
     v1; optional future preference overrides — out of scope unless trivial).
   - Retire → deep-link to inventory item with **suggested** status change;
     user confirms.
   - Move to Wishlist / Analyze Replacement → existing shopping / acquisition
     flows.
6. **Explain (optional)** — AI narrates the plan via RFC-014 Explanation;
   removing AI leaves the plan unchanged.

### Category Analysis (display)

| Signal | Source (conceptual) |
| --- | --- |
| Current Item Count | Inventory (active items in category) |
| Ideal Count | Deterministic heuristic from health / coverage / lifestyle needs (constants + tests) |
| Usage Distribution | Usage Analytics |
| Wardrobe Health | WardrobeHealthEngine (gap / duplicate / coverage for this category) |
| ROI | ROIEngine / purchase + wear realization for category cohort |
| Coverage | Health / recommendation outfit coverage for the category |
| Category Score | Pure composite 0–100 from the above (tunable weights) |

### Item Comparison (metrics)

| Metric | Notes |
| --- | --- |
| Wear Count | From wear logs |
| Cost Per Wear | Existing CPW helpers |
| ROI | Realized / projected where purchase price exists |
| Outfit Coverage | How often the item appears in generated / recommended outfits |
| Recommendation Frequency | How often Recommendation v2 surfaces the item |
| StyleDNA | Category / color / formality / styles / tags |
| Visual Similarity | Best-effort from Vision Intelligence / image attrs when available; omit gracefully |

### Optimization Decisions (plan labels)

| Decision | Meaning |
| --- | --- |
| **Keep** | High-value core; retain and prefer in recommendations |
| **Protect** | Keep but do not over-wear; care / rotation awareness |
| **Rotate** | Under-used or mid peer — actively work back into outfits |
| **Retire** | Candidate to leave active inventory (user confirms) |
| **Ignore** | Out of scope for this plan (e.g. protected, special-purpose) |
| **Move to Wishlist** | Capture a *replacement concept* or complementary piece as wishlist |
| **Analyze Replacement** | Open Buy vs Skip on a suggested prospective item |

## 6. Architecture

Category Optimization is a **pure domain + feature workflow** that **extends**
RFC-015's action surface. It does not invent buy/skip verdicts or replace
Shopping Intelligence.

```
Inventory + Health + Usage + ROI + StyleDNA + Recommendation (+ optional Vision)
        ↓  service assembles CategoryOptimizationContext
CategoryOptimizationEngine (pure)          ← NEW domain
  ├─ analyzeCategory(...)     → CategoryAnalysis
  ├─ compareItems(...)        → ItemComparisonRow[]
  ├─ buildOptimizationPlan(...) → OptimizationPlan
  └─ suggestReplacements(...) → ReplacementOpportunity[]  (deterministic templates
                                 from gaps / missing StyleDNA slots — NOT AI picks)
        ↓
Intelligence Center: Replace.href → Optimize Category UI
        ↓
Shopping Intelligence: accept opportunities → wishlist / queue (user-confirmed)
        ↓
[optional] AI Explanation — narrates plan only
```

### Domain Layer

Proposed package: `src/domain/category-optimization/` (name flexible at
implementation).

- **`analyzeCategory(input) → CategoryAnalysis`** — counts, ideal count, usage
  distribution, health/ROI/coverage slices, `categoryScore`, reason codes.
- **`compareCategoryItems(input) → ItemComparison[]`** — one row per item with
  the metrics in §5; missing signals are `null` (never invented).
- **`buildOptimizationPlan(analysis, comparisons, options) → OptimizationPlan`**
  — assigns Keep / Protect / Rotate / Retire / Ignore using deterministic rules
  (e.g. rank by composite value = f(wears, CPW, ROI, outfit coverage,
  recommendation frequency, StyleDNA uniqueness); excess over ideal count →
  Retire/Rotate candidates from the bottom of the rank). **Protect** for
  high-value but fragile / over-worn pieces.
- **`deriveReplacementOpportunities(plan, health, styleDna) → ReplacementOpportunity[]`**
  — gap-shaped / diversity-shaped prospective stubs (name + category + style
  hints), not purchased SKUs. Evaluated later by Buy vs Skip when the user
  chooses **Analyze Replacement**.
- **Ideal count** — pure function of category taxonomy + wardrobe size + health
  coverage targets (constants in domain; golden-tested). Document the formula in
  implementation; do not hard-code magic per category without tests.

No I/O. Time / `generatedAt` injected. Deterministic given the same context.

### Service Layer

- `src/features/category-optimization/services/category-optimization.service.ts`
  (or under `features/intelligence/`) — load inventory + analytics + ROI +
  recommendation context via existing services/repositories / orchestrator;
  call pure engines; return `{ data, error }`; cache by category fingerprint
  (ADR-006).
- Shopping handoff helper: `proposeWishlistFromOpportunity(opportunity)` —
  creates a **draft** wishlist payload; insert only on user confirm (reuse
  `shopping.service` save path).

### Repository Layer

**None required for Draft v1** if everything recomputes from existing tables
(`wardrobe_items`, wear logs, purchases, health/usage already computed). No new
Supabase access paths beyond existing inventory / analytics / shopping repos.

### UI Layer

- Route: **`/intelligence/optimize`** (query or segment for category key) —
  primary workflow view.
- Wire Intelligence Center `Replace` cards: set `href` to the optimize route
  with category (and optional `itemId` focus).
- Components: `CategoryAnalysisPanel`, `ItemComparisonTable`,
  `OptimizationPlanView`, `ReplacementOpportunitiesList`.
- Execution CTAs link to `/inventory/[id]`, `/acquisitions/wishlist`,
  `/acquisition/advisor`, `/acquisition/screenshot` as appropriate.
- Nav: reachable primarily from Intelligence Center; optional secondary entry
  from Health duplicate rows later (not required for v1).

### AI Layer

- Optional **Explain this plan** via RFC-014 `Explanation` capability.
- **AI never** chooses Keep/Retire counts, ranks items, or invents shopping SKUs
  (ADR-005). If Vision similarity is missing, comparison simply omits that
  column — AI does not fill it.

## 7. Data Flow

```
UI: Replace card → /intelligence/optimize?category=...
  → useCategoryOptimization(categoryKey)
  → categoryOptimization.service.getCategoryOptimization(categoryKey)
      → load: inventory items in category
      → load: usage analytics, wardrobe health, ROI cohort, StyleDNA snapshots
      → load: recommendation / outfit coverage signals (best-effort)
      → load: visual similarity attrs when present (RFC-020)
      → analyzeCategory(...)           ← PURE
      → compareCategoryItems(...)      ← PURE
      → buildOptimizationPlan(...)     ← PURE
      → deriveReplacementOpportunities(...) ← PURE
  → { analysis, comparisons, plan, opportunities, generatedAt }
  → UI renders workflow steps
  → User: Add opportunity to wishlist / Analyze Replacement / open item to retire
      → existing shopping / acquisition / inventory services (writes only on confirm)
  → [optional] AI explains plan text
```

Shopping Intelligence consumption:

```
OptimizationPlan.replacementOpportunities
  → (user confirm) wishlist_items (source: "optimization" or "manual" + notes)
  → RFC-018 PriorityEngine ranks as usual
  → RFC-001 Buy vs Skip when analyzed
```

## 8. Data Model / Schema Impact

**No schema changes required for Draft v1.** Category Optimization is
compute-only over existing inventory + analytics + shopping data, like the
Intelligence Center itself.

**Optional later (document only — do not apply while authoring this RFC):**

```sql
-- OPTIONAL: persist user-accepted plan snapshots for history / 018B learning
-- create table if not exists public.category_optimization_plans (
--   id uuid primary key default gen_random_uuid(),
--   category_key text not null,
--   plan jsonb not null,
--   accepted_at timestamptz,
--   created_at timestamptz not null default now()
-- );
```

Wishlist `source` may already be `manual | url | image`; if a distinct
`optimization` source is desired, that is an **additive** column/check change and
must be called out in the implementation PR (not applied by this RFC).

## 9. API / Domain Contracts

Illustrative (final names at implementation):

```ts
// src/domain/category-optimization/types.ts  (design)

export type OptimizationDecision =
  | "keep"
  | "protect"
  | "rotate"
  | "retire"
  | "ignore";

export type CategoryOptimizationAction =
  | OptimizationDecision
  | "move_to_wishlist"
  | "analyze_replacement";

export interface CategoryAnalysis {
  categoryKey: string;
  label: string;
  currentCount: number;
  idealCount: number;
  usageDistribution: { bucket: string; count: number }[];
  healthScore: number | null;       // 0–100 slice or null
  roiScore: number | null;
  coverageScore: number | null;
  categoryScore: number;            // 0–100 composite
  reasonCodes: string[];
  confidence: number;               // 0–1
}

export interface ItemComparison {
  itemId: string;
  label: string;
  wearCount: number;
  costPerWear: number | null;
  roi: number | null;
  outfitCoverage: number | null;          // 0–1 or count — pick one at impl
  recommendationFrequency: number | null;
  styleDnaSummary: string[];
  visualSimilarityPeers: { itemId: string; score: number }[]; // empty if unavailable
  compositeValue: number;                 // ranking key for the plan
}

export interface OptimizationPlanItem {
  itemId: string;
  label: string;
  decision: OptimizationDecision;
  reason: string;
  reasonCodes: string[];
}

export interface ReplacementOpportunity {
  id: string;
  name: string;
  category: string;
  styleHints: string[];
  rationale: string;
  reasonCodes: string[];
  /** Prospective stub for Buy vs Skip / wishlist — not a verdict. */
  prospective: {
    name: string;
    category: string;
    color?: string | null;
    styleTags?: string[];
    notes?: string | null;
  };
}

export interface OptimizationPlan {
  categoryKey: string;
  summary: {
    keep: number;
    protect: number;
    rotate: number;
    retire: number;
    ignore: number;
  };
  items: OptimizationPlanItem[];
  replacementOpportunities: ReplacementOpportunity[];
  estimatedHealthImprovement: number | null; // delta points, labelled estimate
  estimatedRoiImprovement: number | null;
  generatedAt: string;
}

export interface CategoryOptimizationResult {
  analysis: CategoryAnalysis;
  comparisons: ItemComparison[];
  plan: OptimizationPlan;
}

export function buildCategoryOptimization(
  context: CategoryOptimizationContext,
  options?: { generatedAt?: string; focusItemId?: string },
): CategoryOptimizationResult;
```

Intelligence Center wiring (conceptual):

```ts
// Replace cards gain href, e.g.:
href: `/intelligence/optimize?category=${encodeURIComponent(dup.label)}`
// worn-out:
href: `/intelligence/optimize?category=${categoryKey}&focus=${itemId}`
```

## 10. Acceptance Criteria

- [ ] **Replace cards open Category Optimization** — Intelligence Center
      `replace` actions deep-link into the optimize workflow (category resolved;
      optional item focus).
- [ ] **Category analysis exists** — current count, ideal count, usage
      distribution, health, ROI, coverage, and Category Score are shown.
- [ ] **Item comparison exists** — peer items compared on wear count, CPW, ROI,
      outfit coverage, recommendation frequency, StyleDNA, and visual similarity
      when available.
- [ ] **Optimization plan exists** — deterministic Keep / Protect / Rotate /
      Retire / Ignore assignments with counts, reasons, replacement
      opportunities, and estimated health/ROI improvement.
- [ ] **Shopping suggestions integrate** — opportunities can be sent into
      Shopping Intelligence / wishlist / Buy vs Skip paths (user-confirmed).
- [ ] **No destructive actions occur automatically** — no auto-retire, auto-delete,
      donate, or sell; execution is explicit and uses existing flows.
- [ ] Determinism — same context + `generatedAt` ⇒ identical plan (deep-equal in
      tests).
- [ ] ADR-005 — AI explanation optional; removing it does not change the plan.
- [ ] Documentation only for this RFC authoring pass — **no implementation in the
      RFC PR**.

## 11. QA / Testing Plan

- **Unit tests (Vitest, pure domain):**
  - Ideal count + Category Score boundaries (sparse / normal / over-dense).
  - Comparison ranking: high-wear high-ROI items rank above never-worn duplicates.
  - Plan assignment: over-ideal category produces Retire/Rotate for lowest
    composite value; Keep count matches plan summary; Protect for over-worn
    high-value.
  - Replacement opportunities: derived from gaps / missing diversity slots, not
    random; empty when category is already optimal.
  - Cold path: missing ROI / vision → nulls, plan still builds with lower
    confidence.
  - Determinism golden fixture (e.g. "6 White Casual Tops → Keep 2 / Rotate 2 /
    Retire 2" style scenario from the product brief).
- **Intelligence Center integration:** Replace card `href` present for duplicate
  and worn-out generators; clicking reaches optimize route with correct query.
- **Shopping handoff:** confirming an opportunity creates wishlist draft with
  expected prospective fields; dismissing creates nothing.
- **Destructive guard:** service/UI tests assert no inventory status mutation
  from `buildCategoryOptimization` itself.
- **AI guard:** explanation on/off leaves plan unchanged.
- **Release gate:** `npm test`, `npm run lint`, `npm run build` green (ADR-008).

## 12. Risks & Trade-offs

- **"Replace" naming vs optimize philosophy.** Cards still type `replace` for
  RFC-015 compatibility, but UX copy should say **Optimize category**.
  *Mitigation:* keep `ActionType` stable; change labels + href only (or add
  alias type in a later RFC if needed).
- **Ideal count heuristics are opinionated.** Wrong ideals → bad retire advice.
  *Mitigation:* conservative defaults, high confidence only when duplicates are
  strong; always require user confirm for Retire.
- **Category key ambiguity.** Health duplicate labels may not match inventory
  category taxonomy 1:1. *Mitigation:* normalize/slug map with fallback " unresolved
  category" picker in UI; Open Question §14.
- **Metric sparsity.** Outfit coverage / visual similarity may be empty early.
  *Mitigation:* degrade gracefully; composite value ignores null dimensions.
- **Scope creep into donation/selling.** *Mitigation:* hard non-goals.
- **Shopping duplication.** Opportunities must not bypass Buy vs Skip.
  *Mitigation:* opportunities are prospective stubs only; RFC-001 remains the
  purchase decider.
- **Plan persistence.** Without storing accepted plans, 018B cannot learn from
  optimization outcomes. *Trade-off:* v1 compute-only; optional table later.

## 13. Future Extensions

- Persist accepted plans for Acquisitions Intelligence (018B) outcome learning.
- Bundle Intelligence Center cards: Optimize + Clean + Buy for the same category.
- Visual StyleDNA cluster view inside comparison (RFC-020 accept loop).
- Trip-aware ideal counts (RFC-017 lifestyle demand).
- Soft "Protect" → recommendation down-weight without status change (personalization
  signal).
- Category Optimization from Health dashboard duplicate rows (second entry point).
- Rename or split `ActionType.replace` → `optimize` once UX language is settled.

## 14. Open Questions

1. **Route shape** — `/intelligence/optimize?category=` vs nested
   `/intelligence/optimize/[categoryKey]` vs `/acquisitions/optimize`?
2. **Category identity** — use inventory `category` name, health duplicate
   `label`, or a stable slug map between them?
3. **Ideal count formula** — wardrobe-size percentile, fixed per taxonomy, or
   health coverage targets? What constants ship in v1?
4. **Retire semantics** — suggest `status=retired` only, or also "Ignore in
   recommendations" without retiring?
5. **Wishlist source value** — reuse `manual` with notes, or additive
   `optimization` source?
6. **Worn-out item entry** — always expand to full category optimize, or a
   single-item focused comparison first?
7. **ActionType** — keep `replace` with new copy/href, or introduce `optimize` as
   a new typed action (breaking card consumers / AI tools)?
8. **How strongly to auto-link Shopping** — one-click add-all opportunities vs
   per-opportunity confirm only (lean confirm-only for v1)?
