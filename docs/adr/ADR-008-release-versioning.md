# ADR-008: Release versioning & discipline

- **Status:** Accepted
- **Date:** 2026-07-07

## Context

Wardrobe OS is a personal project built in phases, but "personal" is not an
excuse for undisciplined releases. Without a convention it becomes unclear what
version the code is, what changed, or whether a given state was tested. We want
lightweight but real release discipline: predictable version numbers, a readable
history, and a guarantee that tagged releases are green.

## Decision

Adopt **Semantic Versioning** with named, phased pre-1.0 releases, **Keep a
Changelog**, and a fixed release checklist.

- **Versioning** — SemVer (`MAJOR.MINOR.PATCH`). Pre-1.0 minors are feature
  phases with names, per [ROADMAP.md](../../ROADMAP.md): v0.1 Inventory → …
  → **v0.6 AI Stylist Beta** → … → v1.0 Stable. `package.json` `version` tracks
  the current release.
- **Changelog** — [CHANGELOG.md](../../CHANGELOG.md) in Keep a Changelog format,
  newest first, grouped by Added / Changed / Fixed / etc.
- **Version manifest** — [VERSION.md](../../VERSION.md) records the current
  version, release name, date, included modules, and the next planned version.
- **Release checklist** (also in [CONTRIBUTING.md](../../CONTRIBUTING.md)):
  1. `npm test` passes (**never tag with failing tests**).
  2. `npm run build` succeeds.
  3. Update VERSION.md, CHANGELOG.md, and ROADMAP.md (if a phase changed).
  4. Bump `package.json` version.
  5. Commit the release.
  6. Create an **annotated** SemVer tag and push it:
     ```bash
     git tag -a v0.6.0 -m "Release v0.6.0: AI Stylist Beta"
     git push origin v0.6.0
     ```

## Consequences

- Any commit's version, contents, and roadmap position are unambiguous.
- Tagged releases are reproducible and known-green.
- Annotated tags carry a message and author, and pair naturally with GitHub
  Releases whose notes come straight from the changelog.
- Cost: a few manual steps per release — mitigated by the checklist and by
  Claude Code following it ([CLAUDE.md](../../CLAUDE.md)).

## Alternatives considered

- **No versioning / date tags only.** Zero overhead but no semantics and no
  changelog discipline. Rejected.
- **Fully automated release tooling** (release-please, changesets, semantic-release).
  Powerful, but heavier than a solo project needs and adds config/CI surface.
  Rejected for now; the manual checklist is enough and can be automated later.
- **Lightweight (non-annotated) tags.** No message/author metadata; weaker
  provenance. Rejected in favour of annotated tags.
