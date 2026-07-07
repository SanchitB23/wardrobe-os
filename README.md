# Wardrobe OS

**Version:** v0.6.0 — _AI Stylist Beta_

Wardrobe OS is a personal wardrobe operating system: a single place to catalogue
what you own, understand how you use it, score and generate outfits, and — new
in this release — talk to an **AI stylist** that answers in natural language.

Its defining principle: **deterministic engines decide, AI explains.** All
scoring, eligibility, ranking, health, and cost analysis are computed by pure
TypeScript domain engines. AI is used only to explain, summarise, and converse —
never as the source of truth. See [DECISIONS.md](DECISIONS.md) and
[docs/adr/ADR-005](docs/adr/ADR-005-ai-does-not-decide.md).

## Key features

- **Inventory** — full item CRUD, images (upload + primary + delete), bulk JSON
  import, rich item detail pages, and an advanced filterable inventory table.
- **Analytics** — dashboard, **Wardrobe Health**, **Usage Analytics**,
  **Purchase / cost-per-wear** tracking, and an **Insight Center**.
- **Outfits** — outfit builder, deterministic **Outfit Scoring**, and
  **Outfit Generation** from your wardrobe.
- **Recommendations** — a **Unified Recommendation Engine** (saved + generated
  outfits ranked together) with a debuggable Recommendation Center.
- **AI Stylist (Beta)** — natural-language explanations of recommendations, a
  streaming **tool-calling chat** (`/chat`), a durable AI response cache, and a
  developer **AI Playground** (`/ai/playground`).

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Base UI) |
| Data | Supabase (Postgres + Storage) |
| Client data | TanStack Query |
| AI | Gemini, behind a vendor-neutral AI abstraction |
| Tests | Vitest (pure domain + AI layer) |

## Local setup

```bash
# 1. Install
npm install

# 2. Configure env (see below)
cp .env.example .env.local   # then fill in values

# 3. Run
npm run dev                  # http://localhost:3000
```

### Environment variables

Copy `.env.example` to `.env.local`. Never commit real keys — `GEMINI_API_KEY`
has no `NEXT_PUBLIC_` prefix, so it is never bundled to the browser (all AI calls
are server-side).

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (RLS-gated) | — |
| `AI_PROVIDER` | Which AI backend to use | `gemini` |
| `GEMINI_API_KEY` | Gemini API key (server-side only) | — |
| `GEMINI_MODEL` | Gemini model id | `gemini-2.5-flash` |

## How to run

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build + typecheck |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest suite |
| `npm run test:watch` | Vitest in watch mode |

## Documentation

- [VERSION.md](VERSION.md) — current release + included modules
- [ROADMAP.md](ROADMAP.md) — versioned roadmap (v0.1 → v1.0)
- [CHANGELOG.md](CHANGELOG.md) — release history (Keep a Changelog)
- [ARCHITECTURE.md](ARCHITECTURE.md) — layers, data flow, AI abstraction
- [ENGINE.md](ENGINE.md) — the domain engines + AI tool router
- [DECISIONS.md](DECISIONS.md) — major decisions (indexes the ADRs)
- [CONTRIBUTING.md](CONTRIBUTING.md) — workflow + release discipline
- [docs/adr/](docs/adr/) — Architecture Decision Records

## Roadmap summary

`v0.1` Inventory → `v0.2` Visual Inventory → `v0.3` Analytics →
`v0.4` Outfit Engine → `v0.5` Recommendation Engine →
**`v0.6` AI Stylist Beta (current)** → `v0.7` Acquisition Engine →
`v0.8` Vision AI → `v0.9` Packing / Travel Engine → `v1.0` Stable.

See [ROADMAP.md](ROADMAP.md) for details.
