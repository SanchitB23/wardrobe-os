# RFC-010: Application Access Guard

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Claude (Opus 4.8)
Target Release: v1.0.2
Epic: Product Experience
Priority: High
Effort: M
Dependencies:
- Next.js App Router middleware (repo-root `middleware.ts` — none exists today)
- Web Crypto (`crypto.subtle`) for HMAC signing/verification (Edge/Node-portable)
- `.env.local` (gitignored) for the access code + cookie secret
- ADR-005 (unaffected — this is infrastructure, not a decision engine)

---

## 1. Problem Statement

Wardrobe OS is deployed as a single-user personal application with **no auth**
(it talks to Supabase with the anon key + RLS). The v1.0 audit flagged that
every page and AI route is reachable by anyone with the URL — a cost-abuse and
privacy surface once the app is on a public URL (audit H6/M6).

We do **not** want authentication (users, identities, sessions, OAuth). The
owner wants the app to sit behind **one shared access code** — a lightweight gate
so a stranger who stumbles on the URL cannot use the app, without any of the
weight of an auth system. This is **application-level access control**, not
authentication.

## 2. Goals

- Put a **single access code** in front of the entire application.
- Persist unlocked state in a **signed, HttpOnly cookie** that expires.
- Enforce it in **middleware** so protection is centralized and cannot be
  bypassed per-route.
- Provide a minimal **unlock page** and a **logout** action.
- Keep it **simple, dependency-free** (Web Crypto only), and **stateless** (no
  DB, no user records).

## 3. Non-Goals

Explicitly **not** building any of:

- Authentication / user identity / accounts.
- OAuth / SSO / social login.
- Supabase Auth / any auth provider.
- JWTs (a signed session cookie is used, not a JWT).
- Passwords per user, password reset, or email flows.
- A database, users table, or any persisted session store.
- Role-based access, multi-tenancy, or authorization rules.

The access code is a **shared secret**, not a credential tied to a person.

## 4. User Stories

- As the owner, I want the app to prompt for an access code so a random visitor
  to my deployed URL can't browse my wardrobe or run up AI cost.
- As the owner, once I enter the code, I want to stay unlocked for a while
  (across page loads and restarts) without re-entering it every time.
- As the owner, I want a way to lock it again (logout) — e.g., on a shared
  device.
- As the owner running locally, I don't want the gate to get in my way during
  development.

## 5. UX Flow

```
Visit any URL
   │
   ├─ has valid signed cookie? ── yes ──▶ App renders normally
   │
   └─ no ──▶ 307 redirect to /unlock?next=<original-path>
                 │
                 ▼
        Unlock page: single "Access code" field + Unlock button
                 │  (submit)
                 ▼
        POST /api/access/unlock  ── wrong ──▶ /unlock?error=1 (generic message)
                 │  correct
                 ▼
        Set signed HttpOnly cookie ──▶ 307 redirect to `next` (or `/`)
                 │
                 ▼
        App renders normally

Logout: header/Settings "Lock app" ──▶ POST /api/access/logout
        ──▶ clear cookie ──▶ redirect to /unlock
```

- The unlock page is intentionally minimal: product name, one input, one button,
  a generic error on failure ("Incorrect code"). No hints, no email, no reset.
- Logout lives in **Settings** (and optionally the header menu) as "Lock app".

## 6. Architecture

**This is cross-cutting infrastructure, not a feature-first domain engine.** It
lives alongside `src/lib/supabase` as `src/lib/access`, plus a root
`middleware.ts`, an `/unlock` route, and two tiny route handlers. It touches no
domain engine, no service/repository, and no Supabase — ADR rules are unaffected.

```
Request
   │
   ▼
middleware.ts ──(reads signed cookie, verifies HMAC + expiry)
   │                                   │
   │ valid                             │ invalid / missing
   ▼                                   ▼
 next()  (App / API / Developer)   redirect → /unlock (page)  or  401 (API)
                                        │
                                        ▼
                              POST /api/access/unlock
                              (constant-time compare vs env)
                                        │ ok
                                        ▼
                              Set-Cookie: wos_access=<payload>.<sig>
```

### Middleware (`middleware.ts`, repo root)
- Runs on every request except the exclusions in its `matcher` (see §7).
- Reads the `wos_access` cookie, verifies it with `verifySession` (§9). If valid
  and unexpired → `NextResponse.next()`.
- If invalid/missing:
  - **Page request** → `307` redirect to `/unlock?next=<encoded original path>`.
  - **API request** (`/api/*`, excluding the access endpoints) → `401` JSON
    `{ error: "locked" }` (no redirect — clients get a clean status).
- **Fail-closed** when `ACCESS_CODE` is set but `ACCESS_COOKIE_SECRET` is missing
  (misconfiguration → block, don't silently pass).
- **Disabled** (pass-through) when `ACCESS_CODE` is unset — keeps local dev
  frictionless. Documented trade-off: deployments **must** set `ACCESS_CODE`.
- Must use **Web Crypto** (`crypto.subtle`) so it works regardless of the
  middleware runtime. _Implementer note (AGENTS.md): verify the middleware +
  `NextResponse` cookie APIs against the installed Next version's docs in
  `node_modules/next/dist/docs/` before writing code._

### Access library (`src/lib/access/`)
Pure-ish helpers, no React/Supabase:
- `signSession(exp, secret)` / `verifySession(token, secret)` — HMAC-SHA256 over
  a small payload, base64url-encoded, `payload.signature` format. Signature check
  uses `crypto.subtle.verify` (constant-time).
- `constantTimeEqual(a, b)` — for the access-code comparison.
- `cookieOptions()` — the shared cookie attributes (§9).
- Constants: cookie name, default TTL.

### UI Layer
- **`app/unlock/page.tsx`** — a Server Component page + a small client form that
  POSTs to the unlock endpoint (progressive; works without heavy JS). Themed to
  match the app (PageHeader-free, standalone shell).
- **Logout control** — a "Lock app" button in Settings (reuses the existing
  Settings sectioning from RFC-007) that POSTs to the logout endpoint.

### API Layer (route handlers)
- **`POST /api/access/unlock`** — reads `{ code }`, constant-time compares to
  `process.env.ACCESS_CODE`, and on success issues the signed cookie and returns
  `{ ok: true }` (client redirects to `next`). On failure returns `401`
  `{ ok: false }` (generic). **Excluded from middleware** (reachable while locked).
- **`POST /api/access/logout`** — clears the cookie (`Max-Age=0`), returns
  `{ ok: true }`. Excluded from middleware.

### AI Layer
N/A. (This guard incidentally hardens the AI routes flagged in the audit, but it
adds no AI behaviour.)

## 7. Data Flow

**Unlock:** `/unlock` form → `POST /api/access/unlock` → `constantTimeEqual(code,
ACCESS_CODE)` → `signSession(now + TTL, ACCESS_COOKIE_SECRET)` →
`Set-Cookie: wos_access=<token>; HttpOnly; Secure; SameSite=Lax; Path=/;
Max-Age=<ttl>` → redirect to `next`.

**Protected request:** any request → `middleware.ts` → read `wos_access` →
`verifySession(token, secret)` (recompute HMAC, constant-time verify, check
`exp > now`) → allow or redirect/401.

**Logout:** "Lock app" → `POST /api/access/logout` → `Set-Cookie: wos_access=;
Max-Age=0` → redirect to `/unlock`.

**Middleware matcher** — protect everything except static assets and the access
surfaces:

```ts
export const config = {
  matcher: [
    // everything except: Next internals, common static file extensions,
    // the unlock page, and the access endpoints (reachable while locked).
    "/((?!_next/static|_next/image|favicon.ico|unlock|api/access/).*\\.?.*)",
  ],
};
```

_(Exact regex to be finalized against the installed Next version; intent: skip
`_next/static`, `_next/image`, `favicon.ico`, static file extensions
`png|jpg|jpeg|gif|svg|webp|ico|txt|xml|woff2?`, `/unlock`, and `/api/access/*`.)_

## 8. Data Model / Schema Impact

**No schema changes. No database. No tables. No migration.** State lives entirely
in a signed cookie; nothing is persisted server-side.

**Environment variables (server-only — never `NEXT_PUBLIC_`):**

| Var | Required | Purpose |
| --- | --- | --- |
| `ACCESS_CODE` | to enable the guard | The shared access code. Guard is disabled when unset. |
| `ACCESS_COOKIE_SECRET` | when `ACCESS_CODE` set | HMAC signing secret (≥32 random bytes). Rotating it invalidates all cookies. |
| `ACCESS_SESSION_DAYS` | optional (default 30) | Cookie + payload TTL in days. |

Add all three to `.env.example` (blank/placeholder) and document in the README
env table. `.env.local` stays gitignored.

## 9. API / Domain Contracts

**Cookie:** `wos_access` — `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/`,
`Max-Age = ACCESS_SESSION_DAYS`. Value = `base64url(payload).base64url(hmac)`.

```ts
// src/lib/access/session.ts (Web Crypto; Edge/Node-portable)
type AccessPayload = { v: 1; exp: number }; // exp = ms epoch
function signSession(exp: number, secret: string): Promise<string>;
function verifySession(token: string | undefined, secret: string): Promise<
  { valid: true; exp: number } | { valid: false }
>;
function constantTimeEqual(a: string, b: string): boolean;
export const ACCESS_COOKIE = "wos_access";
```

**Routes:**
- `POST /api/access/unlock` → body `{ code: string }` → `200 { ok: true }`
  + `Set-Cookie` on success; `401 { ok: false }` on wrong code or missing config.
- `POST /api/access/logout` → `200 { ok: true }` + cookie cleared.

No changes to any existing route's contract; existing routes simply become
unreachable (page → redirect, API → 401) until unlocked.

## 10. Acceptance Criteria

- [ ] **Every page is protected** — visiting any app route without a valid cookie
      redirects to `/unlock`; after unlocking, the original destination loads.
- [ ] **Developer Mode is protected** — `/developer`, `/ai/playground`, and the
      `/api/ai/*` routes are behind the guard (they are ordinary routes; the guard
      is orthogonal to the client-side Developer Mode toggle).
- [ ] **API routes are protected** — unauthenticated `/api/*` calls (except
      `/api/access/*`) return `401`, not data.
- [ ] **Static assets are unaffected** — `_next/static`, `_next/image`,
      `favicon.ico`, fonts, and public images load without a cookie (no redirect
      loop, no FOUC on the unlock page).
- [ ] **Cookie is HttpOnly + signed** — not readable by JS; tampering or an
      expired `exp` fails verification and re-locks.
- [ ] **Session expires** — after `ACCESS_SESSION_DAYS`, the app re-prompts.
- [ ] **Logout works** — "Lock app" clears the cookie and returns to `/unlock`.
- [ ] **Local dev is frictionless** — with `ACCESS_CODE` unset, no gate appears.
- [ ] **Wrong code reveals nothing** — generic error, constant-time compare, no
      timing/format oracle.
- [ ] Gate: `npm test` green, `npm run lint` ≤ baseline, `npm run build` passes;
      manual verify of lock → unlock → browse → logout.

## 11. QA / Testing Plan

- **Unit (Vitest):** `signSession`/`verifySession` round-trip; rejects tampered
  payload, tampered signature, wrong secret, and expired `exp`;
  `constantTimeEqual` correctness.
- **Middleware logic:** unit-test the decision helper (given cookie state +
  request kind → allow / redirect / 401) so it's testable without a live server.
- **Manual / preview:**
  - No cookie → `/inventory` redirects to `/unlock?next=/inventory`; wrong code →
    generic error; correct code → lands on `/inventory`.
  - `/api/chat` without cookie → `401`; with cookie → streams.
  - `/developer` + `/ai/playground` gated.
  - Static: `favicon.ico`, a `_next/static/...` chunk, and an item image load
    while locked (unlock page must render).
  - Logout → re-locked.
  - `ACCESS_CODE` unset → app opens directly (dev).
- **Config:** `ACCESS_CODE` set + `ACCESS_COOKIE_SECRET` unset → fail-closed.

## 12. Risks & Trade-offs

- **Shared secret, not identity.** Anyone with the code has full access; there's
  no per-person audit or revocation beyond rotating `ACCESS_COOKIE_SECRET`
  (invalidates all cookies) or changing `ACCESS_CODE`. Accepted — matches the
  single-user model.
- **Brute force.** A single code is guessable if attackers can POST repeatedly.
  Mitigations in scope: constant-time compare + a strong code. **Recommended
  add:** a light attempt delay / lockout on the unlock endpoint (see §13) — kept
  out of the core to honor "simple", but noted as the main residual risk on a
  public URL.
- **`ACCESS_CODE` unset = open.** Convenient for dev, dangerous if forgotten in
  prod. Mitigation: document loudly; optionally add a build/startup warning when
  `NODE_ENV=production` and `ACCESS_CODE` is unset (future).
- **Edge runtime constraints.** Middleware must avoid Node-only APIs; use Web
  Crypto. Per AGENTS.md, verify middleware APIs against the installed Next docs.
- **Not a substitute for RLS / real auth.** The Supabase anon key is still
  shipped to the browser; a determined unlocked user (or the code holder) can
  still hit Supabase directly. This guard reduces exposure to *strangers*, not to
  the code holder. Stated explicitly so it isn't mistaken for real security.
- **Redirect loops.** Misconfigured matcher could loop `/unlock`. The matcher
  must exclude `/unlock` and `/api/access/*`; covered by the QA static-asset test.

## 13. Future Extensions

- Light brute-force protection: in-memory (or cookie-based) failed-attempt
  counter with exponential backoff / temporary lockout on `/api/access/unlock`.
- Production safety check: refuse to boot / log a prominent warning when
  `NODE_ENV=production` and `ACCESS_CODE` is unset.
- "Remember this device" vs "session only" (session cookie) toggle on unlock.
- Rotate-secret runbook in `docs/`.
- If the app ever becomes multi-user, this cleanly gives way to real auth
  (RFC-supersede) — the guard is deliberately isolated in `src/lib/access` +
  middleware to make that swap surgical.

## 14. Open Questions

- **Guard-disabled default:** keep "disabled when `ACCESS_CODE` unset" (dev
  convenience) or fail-closed everywhere and require an explicit
  `ACCESS_GUARD=off` for local dev? (Leaning: disabled-when-unset + a prod
  warning.)
- **Logout placement:** Settings only, or also a header menu item?
- **Session length:** is 30 days the right default TTL?
- **Brute-force mitigation:** include the light lockout (§13) in v1.0.2, or defer?
