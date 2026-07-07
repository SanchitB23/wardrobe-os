# RFCs — Wardrobe OS

An **RFC** ("Request for Comments") is the product + architecture spec for a
major feature. Every major feature is specified in an RFC **before** any code is
written. RFCs are the bridge between the [roadmap/backlog](../product/BACKLOG.md)
and implementation.

> **RFCs are product/architecture specifications — not implementation prompts.**
> An RFC describes *what* we're building and *how it fits the architecture*, so a
> human (or an agent) can implement it later against a clear, reviewed contract.
> It does not contain the implementation, and generating an RFC never changes app
> code or the database.

## The rule

**No major feature is implemented without an approved RFC.**

- "Major" = a new epic item, a new engine, a new AI capability, a schema change,
  or anything that touches multiple layers.
- Trivial fixes, copy tweaks, and refactors that don't change behaviour do not
  need an RFC.
- If unsure whether something needs an RFC, it probably does — write a short one.

## Authoring an RFC

1. Copy [`TEMPLATE.md`](TEMPLATE.md) to `docs/rfc/RFC-XXX-short-title.md`.
2. Use the **next sequential** RFC number (see the index below / the backlog).
3. Fill in the metadata header (Status, Owner, Author, Target Release, Epic,
   Priority, Effort, Dependencies) and every section. Use "No schema changes" /
   "N/A" rather than deleting a section.
4. Start at **Status: Draft**.

## Naming convention

```
docs/rfc/RFC-<3-digit number>-<kebab-case-title>.md
```

- Zero-padded, sequential: `RFC-001`, `RFC-002`, … Numbers are permanent and
  never reused.
- Example: `docs/rfc/RFC-001-buy-vs-skip.md`.
- RFC numbers are reserved in [`docs/product/BACKLOG.md`](../product/BACKLOG.md);
  claim the next free number there.

## Lifecycle & statuses

An RFC moves forward through these statuses (recorded in its `Status:` header):

| Status | Meaning |
| --- | --- |
| **Draft** | Being written. Incomplete or still changing. Not ready for review. |
| **Review** | Complete and open for feedback. Open Questions are being resolved. |
| **Approved** | Reviewed, Open Questions resolved. **Cleared to implement.** |
| **Implemented** | The feature has been built and merged to `main`. |
| **Released** | Shipped in a tagged release (record the version). |

```
Draft ──▶ Review ──▶ Approved ──▶ Implemented ──▶ Released
```

An RFC may be marked **Superseded** (by a newer RFC) or **Abandoned** in its
header if it is dropped; note the reason and the superseding RFC.

## Review / approval process

1. **Draft** — the author writes the RFC from the template.
2. **Review** — flip to `Review`; the Owner reads it, comments, and the author
   resolves the Open Questions (§14).
3. **Approve** — once there are no blocking Open Questions and §10 Acceptance
   Criteria + §11 QA Plan are agreed, the Owner sets `Approved`. Only now may
   implementation begin.
4. **Implement** — build against the RFC; keep it as the source of truth. On
   merge, set `Implemented`. Update the RFC if reality diverged from the spec.
5. **Release** — when it ships in a tagged version, set `Released` and note the
   version; add the feature to [`CHANGELOG.md`](../../CHANGELOG.md).

Approval is the Owner's call (this is a personal project). The point of the
process is that the design is written down and reviewed before code exists.

## Index

_Update this table (and the backlog) as RFCs are created._

| RFC | Title | Epic | Status |
| --- | --- | --- | --- |
| [001](RFC-001-Acquisition-Engine-Buy-vs-Skip.md) | Acquisition Engine — Buy vs Skip | Acquisition Engine | Implemented |
| [002](RFC-002-Vision-Engine.md) | Vision Engine | Vision | Implemented |
| [003](RFC-003-Shopping-Screenshot-Understanding.md) | Shopping Screenshot Understanding | Vision / Acquisition | Implemented |
| [004](RFC-004-Personalization-Engine.md) | Personalization Engine | Intelligence | Draft |

See [`docs/product/BACKLOG.md`](../product/BACKLOG.md) for the epics and the
reserved RFC numbers (RFC-001 … RFC-014).
