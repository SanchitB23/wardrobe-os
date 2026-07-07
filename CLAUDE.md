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
