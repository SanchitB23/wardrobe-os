# Security

Wardrobe OS is a **single-user personal application**. It has no user accounts,
no authentication provider, and no per-user data isolation. This document
describes the security model so its guarantees — and its limits — are explicit.

## Application Access Guard (RFC-010)

The app can be gated behind **one shared access code**. This is
**application-level access control, not authentication** — there is no user
identity, no session store, and no database involved.

### How it works

```
Request → proxy.ts → valid signed cookie? ── yes ─▶ app
                            │
                            └─ no ─▶ page: redirect to /unlock
                                     API:  401 { error: "locked" }
```

- **Proxy** (`proxy.ts`, Next.js 16's renamed middleware) runs on every request
  except static assets, `/unlock`, and `/api/access/*`.
- **Unlock** (`/unlock`) posts the code to `POST /api/access/unlock`, which
  compares it to `APP_ACCESS_CODE` in **constant time** and, on success, issues a
  signed cookie.
- **Cookie** `wos_access` is **HttpOnly**, **Secure** (production),
  **SameSite=Lax**, `Path=/`, and **HMAC-SHA256 signed** with `APP_COOKIE_SECRET`
  (Web Crypto). It carries only an expiry timestamp — no secrets. Tampering or an
  expired stamp fails verification and re-locks.
- **Session** lasts **30 days**, then re-prompts.
- **Logout** (Settings → Access → "Lock app") clears the cookie via
  `POST /api/access/logout`.

### Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_ACCESS_CODE` | to enable the guard | The shared access code. **Blank ⇒ guard disabled** (local dev). |
| `APP_COOKIE_SECRET` | when `APP_ACCESS_CODE` is set | HMAC signing secret (long random value). |

Both are **server-side only** (never `NEXT_PUBLIC_`) and must not be committed;
`.env.local` is gitignored. If `APP_ACCESS_CODE` is set but `APP_COOKIE_SECRET`
is missing, the guard **fails closed** (503) rather than allowing access.

### What it protects — and what it does not

**Protects:** every page, every API route (`/api/*`), the Developer pages
(`/developer`, `/ai/playground`), and the AI routes — from a **stranger** who
lacks the code. Static assets are unaffected.

**Does _not_ protect against the code holder or replace real security:**

- It's a **shared secret**, not an identity — anyone with the code has full access.
- The Supabase **anon key is still shipped to the browser** and RLS is permissive
  (single-user, no-auth model), so an unlocked user (or the code holder) can reach
  Supabase directly. The guard reduces exposure to strangers, not to the holder.
- There is **no built-in brute-force throttling** on the unlock endpoint (see
  below). Use a long, high-entropy code.

### Recommendations

- Use a long, random `APP_ACCESS_CODE` and a ≥32-byte random `APP_COOKIE_SECRET`.
- Set both in every deployed environment (the guard is off when the code is
  blank).
- Rotate `APP_COOKIE_SECRET` to invalidate all sessions; change `APP_ACCESS_CODE`
  to revoke the shared code.
- Consider a reverse-proxy / platform-level rate limit on `/api/access/unlock`
  until in-app brute-force throttling lands (tracked as a future extension in
  [RFC-010](docs/rfc/RFC-010-Application-Access-Guard.md)).

## Secrets

Never commit real secrets. `.env.local` is gitignored; `.env.example` documents
every variable with blank placeholders. `GEMINI_API_KEY`, `APP_ACCESS_CODE`, and
`APP_COOKIE_SECRET` are server-only and never reach the client bundle.

## Reporting

This is a personal project. Report concerns via the repository issues.
