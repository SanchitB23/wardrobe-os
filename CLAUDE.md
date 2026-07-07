@AGENTS.md

# Wardrobe OS — Claude Code project instructions

These rules are binding for all work in this repo. See [ARCHITECTURE.md](ARCHITECTURE.md),
[ENGINE.md](ENGINE.md), [DECISIONS.md](DECISIONS.md), and [docs/adr/](docs/adr/)
for the reasoning.

## Architecture

1. **Always preserve the feature-first architecture** (components → hooks →
   services → repositories → Supabase, plus pure `src/domain` engines and the
   `src/ai` layer).
2. **Components must not call Supabase directly.**
3. **Components must not contain business logic** — they call hooks.
4. **Repositories handle persistence** (the only code that touches Supabase).
5. **Services orchestrate** repositories and domain engines, returning
   `{ data, error }`.
6. **The domain layer (`src/domain/**`) must remain pure TypeScript** — no React,
   Supabase, AI, or I/O; deterministic, with time injected.

## AI

7. **AI must not make deterministic decisions.** It is never the source of truth
   for scoring, eligibility, hard filtering, wardrobe health, recommendation
   ranking, cost-per-wear, or purchase decisions. AI may explain, converse,
   summarise, interpret, and (future) understand images. See
   [ADR-005](docs/adr/ADR-005-ai-does-not-decide.md).
8. **AI must use tool calling for wardrobe operations** — never direct database
   access. See [ADR-007](docs/adr/ADR-007-ai-tool-calling.md).
9. **Prefer deterministic engines first, AI explanation second.**

## Change discipline

10. **Add or update tests** (Vitest) for any domain/engine change.
11. **Do not modify the database schema without clearly calling it out** — state
    what changed, the SQL, and RLS implications. Prefer additive changes.
12. **Before suggesting any new feature, identify the phase/version it belongs
    to** in [ROADMAP.md](ROADMAP.md).

## RFC-driven development

Major features are specified in an **RFC before implementation** (see
[docs/rfc/README.md](docs/rfc/README.md)). **No major feature is implemented
without an approved RFC.** "Major" = a new epic item, a new engine, a new AI
capability, a schema change, or anything touching multiple layers.

Whenever asked to generate an RFC:

1. Use [`docs/rfc/TEMPLATE.md`](docs/rfc/TEMPLATE.md).
2. **Do not implement code.**
3. Save the RFC under `docs/rfc/` (naming: `RFC-XXX-kebab-title.md`).
4. Use the **next sequential** RFC number (reserved in
   [docs/product/BACKLOG.md](docs/product/BACKLOG.md)).
5. Include goals, non-goals, architecture, data flow, acceptance criteria, QA
   plan, risks, and future extensions (every template section).
6. Mark **Status: Draft** unless explicitly told otherwise.
7. **Do not modify application logic** during RFC generation.
8. **Do not modify the database schema** — only *document* schema impact in the
   RFC's §8 unless the task explicitly asks for a migration.

An RFC is a product/architecture spec, not an implementation prompt.

## Releases

13. **For every release:**
    - update `VERSION.md`
    - update `CHANGELOG.md`
    - update `ROADMAP.md` if relevant
    - bump `version` in `package.json`
    - create a git commit
    - create an **annotated** git tag using semantic versioning, e.g.:
      ```bash
      git tag -a v0.6.0 -m "Release v0.6.0: AI Stylist Beta"
      ```
14. **Never create a release tag without tests passing** (`npm test` green).

## Testing note

- `GEMINI_MODEL` in `.env.local` (gitignored): use `gemini-2.5-flash-lite` for
  my automated live testing; switch back to `gemini-2.5-flash` before handing
  off for the user to test, and restart the dev server after changing it.
