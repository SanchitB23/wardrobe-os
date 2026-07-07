# RFC-XXX: <Feature Name>

Status: Draft | Review | Approved | Implemented | Released
Owner: Sanchit Bhatnagar
Author: ChatGPT
Target Release: vX.Y.Z
Epic: <Epic Name>
Priority: Critical | High | Medium | Low
Effort: S | M | L | XL
Dependencies:
- ...

---

## 1. Problem Statement

_What problem are we solving, and why now? Who feels the pain today?_

## 2. Goals

_What this RFC will achieve. Concrete and measurable where possible._

## 3. Non-Goals

_Explicitly out of scope — what we are deliberately NOT doing here._

## 4. User Stories

_As a <user>, I want <capability> so that <outcome>._

## 5. UX Flow

_The end-to-end user experience: entry points, screens/states, and actions._

## 6. Architecture

_How this fits the feature-first architecture. Fill only the layers involved._

### Domain Layer
_Pure, deterministic engines/types. The source of truth._

### Service Layer
_Orchestration: fetch via repositories, map, call domain engines, return
`{ data, error }`._

### Repository Layer
_Persistence: Supabase queries/mutations. Note any new access paths._

### UI Layer
_Components, hooks, routes, and navigation entries._

### AI Layer
_If AI is involved: it explains/summarises/converses only — never decides.
Tools + prompt builders + schemas. State clearly what stays deterministic._

## 7. Data Flow

_Step-by-step flow of data through the layers (UI → hooks → services →
repositories → Supabase, plus domain engines / AI tools as applicable)._

## 8. Data Model / Schema Impact

_Tables/columns added or changed (prefer additive). Include SQL and RLS
implications. State "No schema changes" if none._

## 9. API / Domain Contracts

_Public function signatures, types, route handlers, and tool schemas this RFC
introduces or changes._

## 10. Acceptance Criteria

_Checklist of observable behaviours that mean "done". Each should be testable._

- [ ] ...

## 11. QA / Testing Plan

_Unit tests (domain/AI), integration points, and manual/preview verification.
What must be green before release._

## 12. Risks & Trade-offs

_Technical, product, cost, and correctness risks; the trade-offs chosen and why._

## 13. Future Extensions

_Natural follow-ups this design enables but does not implement now._

## 14. Open Questions

_Unresolved decisions needing an answer before Approved._
