# Contributing

Wardrobe OS is a personal project, but it follows deliberate discipline so it
stays releasable and the architecture doesn't erode. These rules apply to every
change, whether made by a human or by Claude Code (see [CLAUDE.md](CLAUDE.md)).

## Architecture rules (non-negotiable)

1. **Preserve the feature-first architecture** (see [ARCHITECTURE.md](ARCHITECTURE.md)).
2. **Components never call Supabase directly** and **contain no business logic** —
   they call hooks.
3. **Repositories** are the only code that touches Supabase.
4. **Services** orchestrate repositories + domain engines and return
   `{ data, error }`.
5. **The domain layer (`src/domain/**`) stays pure TypeScript** — no React,
   Supabase, AI, or I/O; deterministic, with time injected.
6. **AI never makes deterministic decisions** (scoring, eligibility, filtering,
   health, ranking, cost, purchases). AI explains, converses, summarises,
   interprets. See [ADR-005](docs/adr/ADR-005-ai-does-not-decide.md).
7. **AI reaches wardrobe data only via tool calling** — never direct DB access
   ([ADR-007](docs/adr/ADR-007-ai-tool-calling.md)).

## Working discipline

- **Tests:** add or update Vitest tests for any domain/engine or AI-layer change.
  Run `npm test` before every release; the suite must be green.
- **Database schema:** do not modify the schema without clearly calling it out
  (what changed, the SQL, and RLS implications). Prefer additive changes.
- **New features:** before proposing one, identify which roadmap phase/version it
  belongs to ([ROADMAP.md](ROADMAP.md)).
- **Deterministic first:** solve with a domain engine first; add AI explanation
  second.
- **Major architecture decisions:** record an ADR in `docs/adr/`
  (Status · Context · Decision · Consequences · Alternatives considered).

## Release checklist

For every release ([ADR-008](docs/adr/ADR-008-release-versioning.md)):

1. `npm test` — must pass. **Never tag a release with failing tests.**
2. `npm run build` — must succeed (typecheck).
3. Update **VERSION.md** (version, name, date, modules, next version).
4. Update **CHANGELOG.md** (Keep a Changelog entry).
5. Update **ROADMAP.md** if the phase status changed.
6. Bump `version` in `package.json`.
7. Commit the release.
8. Create an **annotated, SemVer git tag**, e.g.:
   ```bash
   git tag -a v0.6.0 -m "Release v0.6.0: AI Stylist Beta"
   git push origin v0.6.0
   ```

## Commit conventions

- Small, focused commits; imperative subject lines.
- Commit or push only when asked.
- This project uses the `github-personal` SSH alias for GitHub remotes.
