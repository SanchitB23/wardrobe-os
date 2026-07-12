# Wardrobe OS

**Version:** v2.0.1 — _Inventory Image Intelligence_

Wardrobe OS is a personal wardrobe operating system: a single place to catalogue
what you own, understand how you use it, score and generate outfits, plan trips,
optimize purchases, and talk to an **AI stylist** that answers in natural
language. In v2.0 it ships **Trips**, an **Acquisitions** hub with continuous
shopping intelligence, and **Vision** workflows (closet scan / review) — still
opening on **Today** as the daily assistant home. **v2.0.1** adds **Inventory
Image Intelligence**: analyze an item's primary photo, Accept/Reject visual
cues, and gap-fill StyleDNA without overwriting manual fields.

Its defining principle: **deterministic engines decide, AI explains.** All
scoring, eligibility, ranking, health, and cost analysis are computed by pure
TypeScript domain engines. AI is used only to explain, summarise, and converse —
never as the source of truth. See [DECISIONS.md](DECISIONS.md) and
[docs/adr/ADR-005](docs/adr/ADR-005-ai-does-not-decide.md).

## Key features

- **Today** — the default home. An assistant-style dashboard that *composes*
  existing deterministic output: today's outfit, an insight, an Ask-Stylist box
  (deep-links into chat), shopping suggestions, wardrobe health, quick actions,
  and recent activity. It surfaces engine output; it decides nothing new.
- **Inventory** — full item CRUD, images (upload + primary + delete), bulk JSON
  import, rich item detail pages, visual analysis (Accept/Reject), and an
  advanced filterable inventory table.
- **Analytics** — dashboard, **Wardrobe Health**, **Usage Analytics**,
  **Purchase / cost-per-wear** tracking, and an **Insight Center**.
- **Outfits** — outfit builder, deterministic **Outfit Scoring**, and
  **Outfit Generation** from your wardrobe.
- **Recommendations** — **Recommendation Engine v2** (weather- & preference-aware)
  with a debuggable Recommendation Center and **Intelligence Center** actions;
  accepted visual attrs enrich StyleDNA gaps.
- **Acquisitions** — flagship `/acquisitions` hub (wishlist, decision history,
  timeline, ROI, shopping history), deterministic **Buy vs Skip**, **Shopping
  Intelligence** + **Acquisitions Intelligence** (lifecycle, opportunity,
  strategy), and shopping-screenshot capture.
- **Vision** — **Vision Intelligence v2**: closet scan, assisted outfit
  recognition, visual duplicates, and a confirmation review queue (`/vision`);
  plus **Inventory Image Intelligence** on item detail.
- **Lifestyle / Trips** — first-class **Trip Planner** (`/trips`): templates,
  multi-city, packing checklist, timeline, weather refresh.
- **AI Stylist** — natural-language explanations, streaming **tool-calling chat**
  (`/chat`), durable AI response cache, cost-aware AI Runtime (Gemini-first;
  optional OpenAI), and a developer **AI Playground** (behind Developer Mode).
- **Observability** — structured JSON logs for API + AI usage (RFC-022) with
  `requestId` correlation; inspect in Vercel Runtime Logs or Developer →
  Observability.
- **One assistant** — finalized navigation IA, real **Settings** and **About**
  surfaces, **Access Guard**, and a gated **Developer Mode** hub.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Base UI) |
| Data | Supabase (Postgres + Storage) |
| Client data | TanStack Query |
| AI | Gemini + OpenAI, behind a vendor-neutral abstraction (cost-first capability routing, primary → fallback, OpenAI budget guard) |
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
| `AI_PROVIDER` | Legacy single-provider backend | `gemini` |
| `GEMINI_API_KEY` | Gemini API key (server-side only) | — |
| `GEMINI_MODEL` | Gemini model id | `gemini-2.5-flash` |
| `OPENAI_API_KEY` | OpenAI key (RFC-014A, optional). Blank ⇒ falls back to Gemini | — |
| `OPENAI_MODEL_TEXT` | OpenAI text model | `gpt-5.4-mini` |
| `OPENAI_MODEL_STRUCTURED` | OpenAI structured-output model | `gpt-5.4-mini` |
| `OPENAI_MODEL_CLASSIFIER` | OpenAI classification model | `gpt-5.4-nano` |
| `OPENAI_MODEL_PREMIUM` | Premium model (future/manual only; never default) | `gpt-5.5` |
| `OPENAI_MONTHLY_BUDGET_USD` / `OPENAI_SOFT_ALERT_USD` / `OPENAI_HARD_STOP_USD` | OpenAI spend guard | `5` / `2` / `5` |
| `AI_POLICY_<CAPABILITY>` | AI Runtime routing override `primary[,fallback]` | Gemini-first; OpenAI for structured/classification |
| `APP_ACCESS_CODE` | Shared access code for the [Access Guard](SECURITY.md) (server-side only). Blank ⇒ guard disabled. | — |
| `APP_COOKIE_SECRET` | HMAC secret signing the access cookie (required when `APP_ACCESS_CODE` is set) | — |

When `APP_ACCESS_CODE` is set, the whole app is gated behind an
[Application Access Guard](SECURITY.md) (a single shared code — **not** auth):
unauthenticated requests redirect to `/unlock` (pages) or get `401` (API). Lock
it again from **Settings → Access → Lock app**.

## How to run

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build + typecheck |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest suite |
| `npm run test:watch` | Vitest in watch mode |

## Product Vision

For the long-term vision and philosophy behind Wardrobe OS — the deterministic
intelligence thesis, the strategic horizons (v1.0 → v3.0), and the boundaries
the product deliberately holds — see
[docs/product/PRODUCT_VISION.md](docs/product/PRODUCT_VISION.md). It is a product
strategy document, not a roadmap.

## Documentation

- [docs/product/PRODUCT_VISION.md](docs/product/PRODUCT_VISION.md) — long-term product vision & philosophy
- [VERSION.md](VERSION.md) — current release + included modules
- [ROADMAP.md](ROADMAP.md) — versioned roadmap (v0.1 → v2.0)
- [CHANGELOG.md](CHANGELOG.md) — release history (Keep a Changelog)
- [docs/releases/v2.0.1.md](docs/releases/v2.0.1.md) — v2.0.1 release notes
- [docs/releases/v2.0.0.md](docs/releases/v2.0.0.md) — v2.0.0 release notes
- [ARCHITECTURE.md](ARCHITECTURE.md) — layers, data flow, AI abstraction
- [ENGINE.md](ENGINE.md) — the domain engines + AI tool router
- [DECISIONS.md](DECISIONS.md) — major decisions (indexes the ADRs)
- [CONTRIBUTING.md](CONTRIBUTING.md) — workflow + release discipline
- [docs/adr/](docs/adr/) — Architecture Decision Records
- [SECURITY.md](SECURITY.md) — security model + Application Access Guard
- [LICENSE](LICENSE) — MIT

## Roadmap summary

`v0.1` Inventory → `v0.2` Visual Inventory → `v0.3` Analytics →
`v0.4` Outfit Engine → `v0.5` Recommendation Engine →
`v0.6` AI Stylist Beta → `v0.7` Acquisition Engine → `v0.8` Vision AI →
`v0.9` Personalization Engine → `v1.0` Lifestyle + Today →
`v1.1` Intelligence Refinement →
**`v2.0` Lifestyle Intelligence Platform** →
**`v2.0.1` Inventory Image Intelligence**.

See [ROADMAP.md](ROADMAP.md) and [docs/releases/v2.0.1.md](docs/releases/v2.0.1.md).
