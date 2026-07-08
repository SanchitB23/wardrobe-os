# RFC-008: v1.0 Release Candidate — Audit Triage & Remediation

Status: Approved
Owner: Sanchit Bhatnagar
Author: Claude (Opus 4.8)
Target Release: v1.0.0
Epic: Product Experience
Priority: Critical
Effort: L
Dependencies:
- The v1.0 Release Readiness Audit (2026-07-08) — the source of every item triaged here
- RFC-007 Today Experience & v1.0 Product Polish (Implemented) — the surface this RC finalizes
- ADR-005 (AI does not decide), ADR-006 (AI cache), ADR-008 (release/versioning)
- Live Supabase project (RLS policy additions in §8)

---

## 1. Problem Statement

The v1.0 Release Readiness Audit reviewed the entire project across 15 dimensions
(architecture, DB, TypeScript, React, performance, accessibility, security,
Supabase, and every engine subsystem, plus docs/roadmap/RFC/ADR completeness). It
concluded the foundation is strong — **the "AI never decides" boundary is intact
everywhere and tests are green** — but surfaced a set of findings ranging from
genuine data-corruption bugs to cosmetic nits.

We need a single, authoritative decision on **what blocks the v1.0 tag and what
does not**, so the release can be cut with confidence and the deferred work is
recorded rather than lost. This RFC triages **every** audit item into one of five
buckets and defines exactly what gets implemented for the Release Candidate.

## 2. Goals

- Classify **every** audit finding as **Must Fix / Should Fix / v1.1 / v2 / Rejected**.
- Define the Must Fix set as the precise, bounded, high-confidence work that must
  land before `v1.0.0` is tagged.
- Preserve Should Fix / v1.1 / v2 items as tracked, intentional deferrals.
- Keep the audit's core verdict true: ship a **correct, non-corrupting,
  deterministic** v1.0 for the intended single-user / local deployment.

## 3. Non-Goals

- **No new features, engines, or AI capabilities** — this is a hardening pass.
- **No public-internet hardening** (auth, rate limiting) — the app is a
  single-user/local tool for v1.0; those are classified v1.1 (see §6, H6).
- **No architectural refactors** — the cross-feature repository seam is recorded
  as Should Fix / accepted debt, not reworked here.
- This RFC does **not** itself create the git tag — cutting the release is the
  Owner's explicit action after Must Fix lands and tests are green.

## 4. Classification Legend

| Bucket | Meaning |
| --- | --- |
| **Must Fix** | v1.0 is functionally wrong, corrupting, non-deterministic, or fails its own release rule without it. Bounded, high-confidence. **Implemented under this RFC.** |
| **Should Fix** | Real quality/robustness/a11y gap. Not release-blocking for a local single-user tool. Target: v1.0.x fast-follow. |
| **v1.1** | Belongs to a later planned horizon (public hardening, AI Runtime routing, perf at scale). Aligns with the existing ROADMAP v1.1. |
| **v2** | Larger product scope (behavioral capture, persistence, multi-provider, calendar/image-gen). |
| **Rejected** | Reviewed and deliberately not actioned; rationale recorded. |

## 5. Classification of Every Audit Item

IDs match the audit report. "Sev" is the audit's original severity.

### 5.1 Critical / High

| ID | Sev | Finding | Class |
| --- | --- | --- | --- |
| C1 | Critical | RLS: 6 item junction tables missing DELETE; `care_profiles` missing SELECT+DELETE → silent data corruption + PK-violation on 2nd edit | **Must Fix** |
| C2 | Critical | Release not cut: `package.json` 0.6.0 vs docs v1.0.0; CHANGELOG `[Unreleased]` with stale "(in progress)"; no tag | **Must Fix** (docs/version; tag = Owner action) |
| C3 | Critical | 49 `tsc --noEmit` errors in 5 test files (stale fixtures) — violates "never tag without tests passing" | **Must Fix** |
| H1 | High | Buy-vs-Skip: single-word category gaps can never reach `matched >= 2`; the 0.20-weighted gap-fill signal never fires for category gaps | **Must Fix** |
| H2 | High | Personalization `protectedItemIds`/`avoidedItemIds` computed but never wired into recommendation/acquisition scoring — unmet RFC-004 acceptance criterion | **Must Fix** |
| H3 | High | Lifestyle plans non-deterministically timestamped (`generatedAt` fallback to `new Date()` fires in prod); latent in other engines | **Must Fix** |
| H4 | High | Occasion-keyword mapping duplicated across 3 engines and drifted (`"brunch"` unrecognized in hard-eligibility path) | **Must Fix** |
| H5 | High | Chat has no retry/backoff/fallback (bypasses `AIOrchestrator`); re-implements cache-aside ADR-006 rejects | **Should Fix** |
| H6 | High | No auth + no rate limiting + no request-size caps on AI routes | **v1.1** (public-deploy only; app is local single-user) |
| H7 | High | RFC-004 marked `Draft` in 3 docs though fully implemented and depended upon | **Must Fix** (docs) |
| H8 | High | `WardrobeItemRow` casts claim `primary_image_url`/`favorite` not in the SELECT — latent undefined | **Should Fix** |
| H9 | High | Focus-ring contrast fails globally (`--ring` + `ring-ring/50`) — keyboard focus barely visible everywhere | **Must Fix** |
| H10 | High | ~40 Select/Input fields lack programmatic labels (shared `Field`/`Label` pattern never wires `htmlFor`/`id`) | **Should Fix** |
| H11 | High | Global `CommandPalette` forces Supabase client (~240KB) + full wardrobe fetch onto every route (query not gated by `open`) | **Should Fix** |

### 5.2 Medium

| ID | Finding | Class |
| --- | --- | --- |
| M1 | Chat message log missing `role="log"`/`aria-live`; composer unlabeled | **Should Fix** |
| M2 | `CardTitle` renders `<div>` not a heading — no `<h2>` on Settings/About/Developer/Today | **Should Fix** |
| M3 | Light-mode text contrast: `muted-foreground/70` (~2.7:1) on labels; `--input`/`--border` 1.26:1 fails 3:1 | **Must Fix** (bundled with H9 — token edits) |
| M4 | No `next/image`; core `ItemImage` is a raw `<img>` of full-res photos at thumbnail size | **Should Fix** |
| M5 | Bulk JSON import N+1 (~4×N sequential Supabase round-trips) | **Should Fix** |
| M6 | No input-validation library; no length/size caps on chat/vision payloads | **v1.1** (pairs with H6 public hardening) |
| M7 | API error responses leak SDK/provider internals to client | **Should Fix** |
| M8 | Lifestyle `reusePenalty`/`formalityBias` defined but never read; `CapsulePlanner` is dedup-union not set-cover (RFC-006 fidelity) | **v1.1** |
| M9 | Vision confidence badge reports whole-image aggregate, not selected item; `ScreenshotAdvisorView` calls domain fn in `useMemo` (bypasses hooks) | **Should Fix** |
| M10 | Cross-feature repository imports (services reach sibling `repositories/*`) | **Should Fix** (or accept in DECISIONS.md) |
| M11 | `ENGINE.md` missing a PersonalizationEngine section | **Must Fix** (doc completeness; trivial) |
| M12 | OpenMeteo + JSON-import external boundaries cast without runtime schema checks | **Should Fix** |
| M13 | `item_images` policies use role `public` not `mvp_anon_*`; storage bucket SELECT allows listing all object paths | **Should Fix** |
| M14 | Missing tie-break stability (`name.localeCompare` on non-unique names; add `outfitId`) | **Should Fix** |
| M15 | Lifestyle `seasonForMonth` reimplemented hemisphere-blind in a component (wrong season for S. hemisphere) | **Should Fix** |
| M16 | `analytics.repository.ts` casts 2-field select to 10-field type; cross-repo `as unknown as` join casts | **Should Fix** |

### 5.3 Nice-to-have / Smells / Concerns

| ID | Finding | Class |
| --- | --- | --- |
| N1 | No `LICENSE` file | **Must Fix** (decision + file; blocks calling it a public "1.0") |
| N2 | `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` off; `target: ES2017` dated | **v1.1** |
| N3 | Unused `PAGE_CONTAINER` token | **Rejected** (per-page widths intentional; delete later if desired) |
| N4 | 34 `key={index}` sites (skeletons/static lists) | **Rejected** (correct usage, no reorder) |
| N5 | `useStylistChat` `send` callback churns identity per token (masked by ref guard) | **Should Fix** |
| N6 | 17 non-null assertions (env-var `!`, engine-map `!` fragile) | **Should Fix** |
| N7 | Developer tool cards identical "Open" link text; external-link "new tab" cue; a few `Progress` missing `aria-label`; no skip-link | **Should Fix** |
| N8 | Add `server-only` import to AI provider files (compile-time client-leak guard) | **v1.1** |
| N9 | BACKLOG legend drift; push-step reconciliation across CLAUDE.md/CONTRIBUTING/ADR-008 | **Should Fix** |
| N10 | About page hardcodes version string | **Should Fix** |
| N11 | scoreTone reimplemented 4× with drifted thresholds; `InventoryErrorState`/`ItemImage` cross-feature reuse | **Should Fix** |
| N12 | `new Date()` fallbacks scattered across engines claiming determinism | **Must Fix** for the engines on the live path (folded into H3); **Should Fix** for the rest |
| N13 | Signed-URL vs public-URL mixed usage on a public bucket | **v1.1** |
| N14 | "Almost everything is `use client`" / converting presentational components off client | **Rejected** (deliberate TanStack-Query design; no bundle win given import graph) |
| N15 | `GUARDS.minBuyConfidence` 0.4 vs RFC-001's documented 0.35 | **Rejected** (shipped value is intentionally stricter; reconcile the doc note only) |
| N16 | Virtualization / inventory `.limit()` pagination absent | **v1.1** (scale, not a personal-wardrobe issue) |
| N17 | Distinct AI error taxonomy; chat `forceRefresh`; vision retry; prod-gating Playground | **v1.1** |
| N18 | `preference_signals` (behavioral capture) + `trips` persistence tables | **v2** |
| N19 | Multi-provider routing / benchmarking / cost analytics | **v1.1** (matches ROADMAP v1.1 AI Runtime) |
| N20 | Adopt `supabase/migrations` framework; keep `docs/migrations/*.sql` headers in sync with live state | **Should Fix** |
| N21 | `rls_auto_enable()` `SECURITY DEFINER` exec grant to anon | **v1.1** (low real-world risk) |
| N22 | Unindexed FKs / unused indexes (performance advisor) | **v1.1** |

## 6. The Must Fix Set (implemented under this RFC)

The following — and only the following — are implemented as part of the Release
Candidate:

1. **C1 — RLS policies** (additive; §8).
2. **C3 — Fix 49 `tsc` errors** in the 5 stale test-fixture files.
3. **H1 — Buy-vs-Skip category-gap scoring**: single-token gap labels must be
   matchable; the highest-weighted signal must fire for category gaps.
4. **H2 — Wire `protectedItemIds` / `avoidedItemIds`** into `RecommendationContext`
   and the recommendation + acquisition scoring paths: avoided items are excluded
   / penalized; protected items are never recommended for removal.
5. **H3 (+ N12 live path) — Determinism**: make `generatedAt` a required input on
   engine entry points on the live path; remove the internal `new Date()` fallback
   so callers pass a single instant.
6. **H4 — Occasion mapping**: one shared occasion-resolution module consumed by all
   three engines; add the missing aliases (`brunch` → social, etc.).
7. **H7 — RFC-004 status** → `Implemented` in the RFC header, `docs/rfc/README.md`
   index, and BACKLOG.
8. **H9 + M3 — Contrast tokens**: fix `--ring` (and `ring-ring/50` usage) and the
   light-mode `--muted-foreground` (on-text usages) / `--input` / `--border`
   tokens to meet WCAG AA (4.5:1 text, 3:1 non-text).
9. **M11 — `ENGINE.md`**: add the PersonalizationEngine section.
10. **N1 — LICENSE**: add a license file (MIT unless the Owner directs otherwise)
    and link it from README.
11. **C2 — Release finalization**: strip stale "(in progress)" labels; move the
    v1.0.0 content from `[Unreleased]` to a dated `## [1.0.0]`; bump
    `package.json` → `1.0.0`. **The annotated tag + push remain the Owner's
    explicit action.**

## 7. Architecture

This RFC touches multiple layers but **adds no new architecture**. It corrects
existing code within the established layering.

### Domain Layer
- New shared occasion-resolution module (H4), consumed by
  `OutfitRecommendationEngine`, `OutfitGenerationEngine`, and the unified engine —
  replaces three drifted copies. Pure, deterministic, tested.
- `generatedAt` becomes required on live-path engine entry points (H3/N12).
- Protected/avoided item sets flow into `RecommendationContext` and are consumed
  by the unified recommendation engine (exclude/penalize) and `BuyVsSkipEngine`
  (never suggest removing a protected item) (H2). Still 100% deterministic — no AI.
- Buy-vs-Skip gap matching handles single-token category labels (H1).

### Service Layer
- Services on the live path pass an explicit `generatedAt` (one instant per
  request) instead of relying on engine fallbacks (H3).
- `RecommendationContextBuilder` forwards protected/avoided ids already derived by
  personalization (H2).

### Repository Layer
- **No code change** — the RLS gaps (C1) are fixed in the database (additive
  policies), tracked as a migration file. Repositories already issue the
  DELETE/SELECT calls that the new policies authorize.

### UI Layer
- Theme token edits in `globals.css` (H9/M3). No component logic changes.

### AI Layer
- **Unchanged.** The AI-decides-nothing boundary is preserved; every Must Fix item
  keeps decisions in the deterministic engines.

## 8. Data Model / Schema Impact

**No schema (table/column) changes.** RLS-policy additions only — additive, and
matching the existing `mvp_anon_*` / `using (true)` convention (single-user,
anon-key, no-auth MVP posture, unchanged).

```sql
-- C1: DELETE on the six item-relation junction tables
create policy mvp_anon_delete_item_materials on public.item_materials for delete to anon using (true);
create policy mvp_anon_delete_item_seasons   on public.item_seasons   for delete to anon using (true);
create policy mvp_anon_delete_item_styles    on public.item_styles    for delete to anon using (true);
create policy mvp_anon_delete_item_features  on public.item_features  for delete to anon using (true);
create policy mvp_anon_delete_item_tags      on public.item_tags      for delete to anon using (true);
create policy mvp_anon_delete_item_occasions on public.item_occasions for delete to anon using (true);

-- C1: SELECT + DELETE on care_profiles (item_id is the PK; INSERT already exists)
create policy mvp_anon_select_care_profiles on public.care_profiles for select to anon using (true);
create policy mvp_anon_delete_care_profiles on public.care_profiles for delete to anon using (true);
```

**RLS implications:** grants anon the DELETE the app already attempts (relations
wipe-and-reinsert on edit) and the SELECT/DELETE `care_profiles` needs. No new
data is exposed beyond what the single-user app already reads/writes; consistent
with the documented anon-key trade-off. Tracked in
`docs/migrations/RFC-008-rls-policies.sql` and applied to the live project.

## 9. API / Domain Contracts

- **New:** `resolveOccasion(...)` (or equivalent) shared occasion module —
  single source of the occasion→keyword map.
- **Changed:** engine entry points on the live path take a **required**
  `generatedAt: string`.
- **Changed:** `RecommendationContext` gains `protectedItemIds` / `avoidedItemIds`
  (already derived by personalization); the unified recommendation engine and
  `BuyVsSkipEngine` consume them.
- **Changed:** Buy-vs-Skip gap match accepts single-token category labels.
- No route-handler or tool-schema changes.

## 10. Acceptance Criteria

- [ ] All 8 RLS policies exist on the live project; editing an item's relations no
      longer accumulates stale rows; a second edit of care info succeeds (C1).
- [ ] `npx tsc --noEmit` is clean (0 errors), including test files (C3).
- [ ] A Buy-vs-Skip evaluation against a single-word category gap (e.g. first pair
      of shoes vs a `footwear` gap) yields a strong gap-fill contribution (H1).
- [ ] An `avoided` item is never returned by the unified recommender; a `protected`
      item is never surfaced as a removal suggestion (H2), with tests.
- [ ] Engine live paths pass an explicit `generatedAt`; no engine reads wall-clock
      internally on that path; determinism tests pass (H3).
- [ ] `"brunch"` (and other aliases) resolve identically across all three engines;
      one shared module; test covers the aliases (H4).
- [ ] RFC-004 shows `Implemented` in header, index, and BACKLOG (H7).
- [ ] `--ring`, `--muted-foreground` (on text), `--input`, `--border` meet WCAG AA
      in light and dark; focus rings are visible (H9/M3).
- [ ] `ENGINE.md` has a PersonalizationEngine section (M11).
- [ ] A `LICENSE` file exists and is linked from README (N1).
- [ ] CHANGELOG has a dated `## [1.0.0]`; no stale "(in progress)"; `package.json`
      is `1.0.0` (C2).
- [ ] `npm test`, `npm run lint` (at/below baseline), and `npm run build` all green.

## 11. QA / Testing Plan

- **Domain (Vitest):** new/updated tests for the shared occasion module (aliases +
  eligibility parity), Buy-vs-Skip single-token category gap, protected/avoided
  exclusion/penalty, and `generatedAt` determinism. Fix the 5 stale fixtures (C3).
- **DB:** verify policies via the Supabase advisors + a manual edit→re-edit of an
  item's relations and care info (no stale rows, no PK error).
- **A11y:** re-check `--ring` / text-token contrast ratios meet AA; keyboard focus
  visible on Today/Settings.
- **Build gate:** `npm test` (expect ≥385 green), `npx tsc --noEmit` (0), `npm run
  lint` (≤ baseline), `npm run build` (pass) before the Owner cuts the tag.

## 12. Risks & Trade-offs

- **H2 (protected/avoided wiring)** is the highest-risk change — it alters
  recommendation output. Mitigation: additive filtering with explicit tests;
  behavior with empty protected/avoided sets is unchanged.
- **RLS additions** touch the live shared project. Mitigation: additive,
  drop-safe, tracked as a migration file; no schema/column change.
- **Deferring H6/M6** (auth/rate-limiting/validation) means the app is **not**
  safe on a public URL. Trade-off accepted: v1.0 is scoped to single-user/local
  use, stated explicitly in the release notes.
- **Deferring H10/M-series a11y** means v1.0 ships with unlabeled form fields and a
  few heading-semantics gaps. Trade-off: the two highest-impact a11y issues
  (focus-ring + core token contrast) are fixed now; the rest is a documented
  v1.0.x fast-follow.

## 13. Future Extensions

- v1.0.x fast-follow: the Should Fix set (a11y labels, `next/image`, chat
  resilience, N+1, duplication cleanups).
- v1.1: public-deployment hardening (auth, rate limiting, validation), AI Runtime
  routing/benchmarking, perf-at-scale (virtualization, pagination), tsconfig
  tightening, `supabase/migrations` adoption.
- v2: behavioral signal capture (`preference_signals`), trip persistence.

## 14. Open Questions

- **License choice** (N1): MIT assumed unless the Owner prefers Apache-2.0 or
  "proprietary / all rights reserved."
- **When to cut the tag** (C2): this RFC finalizes docs/version and leaves the
  annotated `v1.0.0` tag + push as the Owner's explicit go.
