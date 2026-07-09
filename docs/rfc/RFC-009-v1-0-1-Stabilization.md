# RFC-009: v1.0.1 Stabilization Release

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Claude (Opus 4.8)
Target Release: v1.0.1
Epic: Product Experience
Priority: High
Effort: L
Dependencies:
- RFC-008 v1.0 Release Candidate (Implemented) — the source of the deferred backlog triaged here
- The v1.0 Release Readiness Audit (2026-07-08)
- v1.0.0 shipped (`package.json` 1.0.0, tag `v1.0.0`)

---

## 1. Problem Statement

v1.0.0 shipped correct and non-corrupting for the intended single-user / local
deployment. RFC-008 deliberately deferred a bounded set of quality issues
(Should Fix / v1.1 / v2) so the release could be cut. This RFC gathers **every
deferred audit issue** and plans a **stabilization patch** that pays down the
highest-value quality debt — **no new features, no new engines, no new AI
capabilities**. It is a hardening/quality release, not a product release.

## 2. Goals

- Re-triage **every deferred audit issue** into **Must Fix / Should Fix /
  Can Wait / Rejected**, grouped by **Performance, Accessibility, Architecture,
  Developer Experience, AI Runtime**.
- Ship the Must Fix set and as much Should Fix as effort allows in v1.0.1.
- Improve measurable quality (bundle weight on every route, WCAG-AA coverage,
  type-safety, AI resilience) with **zero behaviour/feature change** the user
  would perceive as new.
- Leave Can Wait / Rejected recorded and out of scope.

## 3. Non-Goals

- **No new features / engines / AI capabilities** (this is the defining constraint).
- **No public-internet hardening** (auth, full rate-limiting) — that remains the
  v1.1 AI-Runtime/security epic; only cheap, local-safe hardening is in scope.
- **No multi-provider AI routing / benchmarking** — v1.1 feature epic (rejected here).
- **No schema/table changes** beyond additive index/policy hygiene if any Must Fix
  requires it (none currently does).

## 4. Classification Legend

| Bucket | Meaning |
| --- | --- |
| **Must Fix** | Correctness-adjacent, high-blast-radius, or systemic quality gap; bounded. Ships in v1.0.1. |
| **Should Fix** | Real quality/robustness/a11y improvement; ship in v1.0.1 as effort allows, else v1.0.2. |
| **Can Wait** | Low impact for a local single-user tool, or larger lift; defer to v1.0.2 / v1.1. |
| **Rejected** | Reviewed and deliberately not actioned; rationale recorded. |

IDs map to the v1.0 audit / RFC-008. Everything below was **deferred** by RFC-008
(nothing already fixed in v1.0.0 is repeated).

## 5. Classification by Dimension

### 5.1 Performance

| ID | Item | Class |
| --- | --- | --- |
| H11 | Global `CommandPalette` forces the Supabase client (~240 KB) + a full wardrobe fetch onto **every** route (query not gated by `open`) | **Must Fix** |
| M4 | No `next/image`; core `ItemImage` renders full-res Storage photos as raw `<img>` at thumbnail size | **Should Fix** |
| M5 | Bulk JSON import N+1 (~4×N sequential Supabase round-trips) | **Should Fix** |
| N16 | No virtualization; inventory fetch has no `.limit()`/pagination | **Can Wait** (fine at personal-wardrobe scale) |
| N22 | Unindexed FKs / unused indexes (advisor) | **Can Wait** (no correctness impact) |

### 5.2 Accessibility

| ID | Item | Class |
| --- | --- | --- |
| H10 | ~40 Select/Input fields lack a programmatic label (shared `Field`/`Label` pattern never wires `htmlFor`/`id`) | **Must Fix** |
| M1 | Chat message log has no `role="log"`/`aria-live`; composer unlabeled (flagship flow silent to screen readers) | **Must Fix** |
| M2 | `CardTitle` renders `<div>` not a heading — Settings/About/Developer/Today have no `<h2>` | **Should Fix** |
| N7 | Identical "Open" dev links, external "new tab" cue, a few `Progress` missing `aria-label`, no skip-link | **Should Fix** |

### 5.3 Architecture

| ID | Item | Class |
| --- | --- | --- |
| M15 | Hemisphere-blind `seasonForMonth` reimplemented in `LifestyleTripView` (wrong season for S. hemisphere + business logic in a component) | **Must Fix** |
| H8 | `WardrobeItemRow` casts claim `primary_image_url`/`favorite` not in the SELECT (latent undefined) | **Should Fix** |
| M10 | Services import sibling features' `repositories/*` directly (`selectRecommendationData` used by 4 features) | **Should Fix** (or formally accept in DECISIONS.md) |
| M16 | `analytics.repository` select-string impersonation + cross-repo `as unknown as` join casts | **Should Fix** |
| M9 | `ScreenshotAdvisorView` calls the domain fn in `useMemo`, bypassing the hooks layer | **Should Fix** |
| N11 | `scoreTone` reimplemented ×4 (drifted thresholds); `InventoryErrorState`/`ItemImage` reused cross-feature instead of living in `shared/ui` | **Should Fix** |
| M8 | Lifestyle `reusePenalty`/`formalityBias` defined but never read; `CapsulePlanner` is dedup-union not set-cover | **Can Wait** (RFC-006 fidelity; needs design, borderline feature) |
| N5 | `useStylistChat` `send` callback churns identity per streamed token | **Can Wait** (masked by ref guard) |
| N6 | Fragile non-null assertions (env vars, engine map) | **Can Wait** (mostly safe today) |
| N3 | Unused `PAGE_CONTAINER` token | **Rejected** (per-page widths intentional) |
| N4 | `key={index}` (34 sites) | **Rejected** (skeletons/static lists, never reorder) |
| N14 | Convert presentational components off `"use client"` | **Rejected** (deliberate TanStack-Query design; no bundle win) |
| N15 | `GUARDS.minBuyConfidence` 0.4 vs RFC-001's documented 0.35 | **Rejected** (shipped value intentionally stricter; doc-note only) |

### 5.4 Developer Experience

| ID | Item | Class |
| --- | --- | --- |
| N10 | About page hardcodes the version string (2nd source of truth per release) | **Should Fix** |
| N2a | Bump `tsconfig` `target` ES2017 → ES2022 (modern, low-risk) | **Should Fix** |
| N9 | BACKLOG status-legend drift; reconcile the "push branch+tag" step across CLAUDE.md / CONTRIBUTING / ADR-008 | **Should Fix** |
| N2b | Enable `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` | **Can Wait** (meaningful lift; surfaces many latent gaps) |
| N20 | Adopt `supabase/migrations`; keep `docs/migrations/*.sql` headers in sync with live state | **Can Wait** (infra improvement) |

### 5.5 AI Runtime

| ID | Item | Class |
| --- | --- | --- |
| H5 | Chat bypasses `AIOrchestrator` → no retry/backoff/fallback; re-implements the cache-aside ADR-006 rejects | **Should Fix** |
| M7 | API error responses leak SDK/provider internals to the client | **Should Fix** |
| N8 | Add `server-only` import to AI provider files (compile-time client-leak guard) | **Should Fix** |
| M6 | Request-size caps on chat/vision payloads (cheap cost-abuse guard) | **Should Fix** (size caps only; full zod adoption is Can Wait) |
| N17a | Distinct AI error taxonomy + vision retry | **Should Fix** |
| N17b | Prod-gate the Playground/dev routes | **Can Wait** |
| N13 | Reconcile signed-URL vs public-URL usage on the public bucket | **Can Wait** |
| N21 | `rls_auto_enable()` `SECURITY DEFINER` exec grant to anon | **Can Wait** (low real-world risk) |
| H6 | Auth + rate limiting on AI routes | **Can Wait** (public-deploy only; v1.1 security epic) |
| N19 | Multi-provider routing / benchmarking / cost analytics | **Rejected** (v1.1 AI-Runtime *feature* epic — out of stabilization scope) |
| N18 | Behavioral signal capture (`preference_signals`) + trip persistence | **Rejected** (v2 feature scope) |

### 5.6 Summary counts

| Bucket | Count | Items |
| --- | --- | --- |
| **Must Fix** | 4 | H11, H10, M1, M15 |
| **Should Fix** | 15 | M4, M5, M2, N7, H8, M10, M16, M9, N11, N10, N2a, N9, H5, M7, N8, M6, N17a — _(17 sub-items; some share IDs)_ |
| **Can Wait** | 10 | N16, N22, M8, N5, N6, N2b, N20, N17b, N13, N21, H6 |
| **Rejected** | 6 | N3, N4, N14, N15, N19, N18 |

## 6. Architecture

This RFC changes **no** architecture. Every item is a fix *within* the established
feature-first layering. Notable shape of the work:

- **Performance:** `CommandPalette` becomes lazy (`next/dynamic`, `ssr:false`) with
  its wardrobe query gated on open; `ItemImage` migrates to `next/image` behind a
  Supabase-Storage `remotePatterns` entry; the JSON-import path batches its reads.
- **Accessibility:** a single shared `Field`/`Label` pairing helper wires
  `htmlFor`/`id` (fixes ~40 fields centrally); `CardTitle` renders a heading;
  chat gains a live region.
- **Architecture:** promote `selectRecommendationData` to a shared read module or a
  service seam (removes 4 cross-feature repo imports); split `WardrobeItemRow` into
  raw vs image-joined types; hoist `scoreTone`/`ErrorState`/`ItemImage` into
  `shared/ui`; move the season lookup into the weather/domain layer.
- **AI Runtime:** route chat through a retry-capable path and the shared AI cache;
  add `server-only` guards, request-size caps, and generic client-facing errors.

## 7. Data Flow

Unchanged. No new data paths; fixes tighten existing ones (lazy query in the
command palette, batched import reads, image transforms via `next/image`).

## 8. Data Model / Schema Impact

**No schema changes.** (Can-Wait item N22 index tuning, if ever pursued, would be
additive `CREATE INDEX` only — explicitly out of v1.0.1 scope.)

## 9. API / Domain Contracts

No public contract changes. Internal-only refactors: a shared occasion-style
`Field` helper, a shared score-tone/`ScoreBadge`, split row types, and a
retry-capable chat model wrapper. All additive or behaviour-preserving.

## 10. Success Criteria

- [ ] **Perf:** the shared First-Load-JS baseline drops (Supabase client no longer
      on `/about`, `/settings`, `/developer`, `/_not-found`); `CommandPalette` data
      loads only on first open. Measured via `route-bundle-stats.json` before/after.
- [ ] **Perf:** JSON bulk import issues O(1)-ish batched queries, not ~4×N.
- [ ] **A11y:** an automated axe/Lighthouse pass on Today/Inventory/Settings/Chat
      reports **0 serious/critical** violations for labels, contrast, and names;
      every form control has an accessible name; chat responses are announced.
- [ ] **Architecture:** no feature service imports another feature's
      `repositories/*` (lint/grep check); `WardrobeItemRow` no longer claims
      unfetched fields; a single `scoreTone`/`ScoreBadge` exists.
- [ ] **AI:** a transient provider 429/503 during chat is retried/handled, not
      surfaced raw; client error bodies are generic; `server-only` guards compile.
- [ ] **Gate:** `npm test` green (≥394), `npx tsc --noEmit` clean, `npm run lint`
      **at or below** the current baseline (8 errors / 2 warnings), `npm run build`
      passes, live preview verified light + dark with no console errors.
- [ ] **No feature drift:** no new routes, engines, tools, or user-visible
      capabilities added.

## 11. QA / Testing Plan

- **Unit (Vitest):** new/updated tests for the batched import path, the shared
  score-tone helper, split row types, and the retry-capable chat wrapper (mocked
  transient failure → retry → success).
- **A11y:** automated axe run per key route + manual keyboard pass (focus visible,
  all controls reachable and named); verify chat `aria-live` announces.
- **Perf:** capture `route-bundle-stats.json` and a cold-load network trace before
  and after the `CommandPalette` change; confirm no Supabase request on `/about`.
- **Regression:** full `npm test` + build + light/dark preview across all routes.

## 12. Implementation Plan

Phased so each phase is independently shippable and verifiable.

**Phase 0 — Baseline capture (0.5 day)**
Record current bundle stats, an axe report per route, and the lint/test baseline
so Success Criteria are measurable.

**Phase 1 — Must Fix (2–3 days)**
1. H11 — lazy + gated `CommandPalette` (biggest perf win, every route).
2. H10 — shared labelled `Field`/`Label` helper; migrate the ~40 fields.
3. M1 — chat `aria-live` log + composer label.
4. M15 — route the season lookup through the weather/domain layer.
Verify: build + bundle delta, axe pass, tests.

**Phase 2 — Should Fix: Architecture & Types (2–3 days)**
H8 (split row types), M10 (shared read seam / accept in DECISIONS), M16 (cast
cleanup), M9 (hooks-layer for ScreenshotAdvisor), N11 (shared `scoreTone` +
`ErrorState`/`ItemImage`).

**Phase 3 — Should Fix: AI Runtime (1.5–2 days)**
H5 (retry/fallback + shared cache), M7 (generic client errors), N8 (`server-only`),
M6 (request-size caps), N17a (vision retry + error taxonomy).

**Phase 4 — Should Fix: Perf, A11y polish, DX (1.5–2 days)**
M4 (`next/image` + `remotePatterns`), M5 (batched import), M2 (`CardTitle`
heading), N7 (link/label/skip-link polish), N10 (version single-source), N2a
(ES2022 target), N9 (doc reconciliation).

**Phase 5 — Release (0.5 day)**
Run the Release Checklist (§13); cut `v1.0.1`.

_Can Wait / Rejected items are explicitly not scheduled._

## 13. Release Checklist (v1.0.1)

- [ ] All Must Fix (Phase 1) merged; Should Fix merged as far as effort allowed.
- [ ] `npm test` green · `npx tsc --noEmit` clean · `npm run lint` ≤ baseline ·
      `npm run build` passes.
- [ ] Live preview verified (light + dark), no console errors; axe pass recorded.
- [ ] Bundle-size delta recorded in the PR/commit (proof of the perf win).
- [ ] Update `VERSION.md`, `CHANGELOG.md` (dated `## [1.0.1]`), `ROADMAP.md` if
      relevant, and this RFC → **Implemented**.
- [ ] Bump `package.json` → `1.0.1`.
- [ ] Commit; annotated tag `git tag -a v1.0.1 -m "Release v1.0.1: Stabilization"`.
- [ ] Push `main` + tag.
- [ ] Move any un-shipped Should Fix items to a v1.0.2 note in the BACKLOG.

## 14. Estimated Effort

| Phase | Scope | Estimate |
| --- | --- | --- |
| 0 | Baseline capture | 0.5 day |
| 1 | Must Fix (H11, H10, M1, M15) | 2–3 days |
| 2 | Should Fix — Architecture & types | 2–3 days |
| 3 | Should Fix — AI Runtime | 1.5–2 days |
| 4 | Should Fix — Perf/A11y/DX | 1.5–2 days |
| 5 | Release | 0.5 day |
| **Total** | **Must Fix + full Should Fix** | **~8–11 days** |
| _Minimum_ | _Phase 0–1 + release only (Must Fix)_ | _~3–4 days_ |

Effort is solo-dev, calendar-agnostic. If time-boxed, ship **Must Fix + AI Runtime
+ A11y** first (highest user-visible quality per day) and roll the rest to v1.0.2.

## 15. Open Questions

- **M10 (cross-feature repo seam):** fix now (extract a shared read module) or
  formally accept as documented debt in `DECISIONS.md`? (Affects Phase 2 effort.)
- **Effort ceiling:** is v1.0.1 the full ~8–11-day pass, or a time-boxed Must-Fix
  patch with a fast v1.0.2 to follow?
