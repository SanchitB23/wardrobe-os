# Vercel Logging & Observability (RFC-022)

Structured JSON logs are emitted to **stdout/stderr** so Vercel Runtime Logs can
filter them. No external vendor (Datadog, Sentry, OTel) is required.

Env flags (see `.env.example`):

| Flag | Default | Purpose |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `LOG_AI_USAGE` | `true` | Emit `kind:"ai_usage"` per AI call |
| `LOG_REQUESTS` | `true` | Emit `kind:"api_request"` per API completion |
| `LOG_ENGINE_TRACES` | `false` | Emit `kind:"engine_trace"` orchestrator summaries |
| `LOG_REDACTED` | `true` | Enforce redaction (keep `true` in production) |
| `REPLAY_CAPTURE` | unset | Dev-only: capture sanitized API metadata for `/developer/replay` |

## How to inspect Vercel logs

1. Open **Vercel → Project → Logs** (Runtime / Functions).
2. Pick a deployment and time range.
3. Search for a known `requestId`, or for `"kind":"ai_usage"` /
   `"kind":"api_request"`.
4. For fallback debugging, search `"usedFallback":true`.
5. Pair with `/developer/ai-runtime` for process-local aggregates (not a
   substitute for per-request Vercel lines on serverless).

Local / preview: Developer Mode → **Observability** (`/developer/observability`)
shows a process-local ring buffer of recent lines (cap 200). On multi-instance
serverless this buffer is best-effort only — **Vercel Logs are the production
source of truth**.

## Example API log

```json
{"kind":"api_request","level":"info","message":"POST /api/chat 200","source":"api","requestId":"7c2e1a8b-1234-4abc-9def-0123456789ab","timestamp":"2026-07-12T07:00:01.234Z","method":"POST","route":"/api/chat","statusCode":200,"latencyMs":1842,"userAgent":"ua_h:a1b2c3d4e5f6","ip":"ip_h:d4e5f6a1b2c3","errorCode":null}
```

## Example AI usage log

```json
{"kind":"ai_usage","level":"info","message":"ai_usage conversation ok","source":"ai_runtime","requestId":"7c2e1a8b-1234-4abc-9def-0123456789ab","timestamp":"2026-07-12T07:00:01.200Z","route":"/api/chat","capability":"conversation","provider":"gemini","model":"gemini-2.5-flash","fallbackProvider":"openai","usedFallback":false,"promptVersion":"chat-v1","cacheHit":false,"inputTokens":1200,"outputTokens":340,"totalTokens":1540,"tokenSource":"provider","estimatedCostUsd":0.00021,"costSource":"estimated","latencyMs":1605,"status":"ok","errorCode":null}
```

When tokens are missing: `inputTokens`/`outputTokens`/`totalTokens` are `null`
and `tokenSource` is `"unavailable"`. Estimated costs always set
`costSource:"estimated"` (directional — never billed truth; see RFC-014B).

## Redaction rules

**Never logged** (when `LOG_REDACTED=true`):

- API keys / secrets (`*_API_KEY`, `*_SECRET*`, Authorization, cookies)
- Access codes / unlock tokens (RFC-010)
- Image base64 / `data:` URLs
- Raw prompts / chat message bodies (by default)
- Full wardrobe item lists / StyleDNA blobs

**Allowed:** hashed IP (`ip_h:…`), hashed User-Agent (`ua_h:…`), stable
`errorCode`, HTTP status, capability / model ids, token counts, estimated cost,
capability id lists on engine traces.

## requestId debugging workflow

1. Reproduce the failure (UI or `curl`).
2. Copy `requestId` from:
   - the `x-request-id` response header, or
   - the JSON error body (`requestId` field on status ≥ 400 when practical).
3. In Vercel Logs, search that UUID.
4. Correlate in order: `api_request` → `ai_usage` / `weather_request` (and
   optionally `engine_trace` if `LOG_ENGINE_TRACES=true`).
5. In Developer Mode, use **Request Trace** on `/developer/observability` or
   open `/developer/ai-runtime` for process-local cost / fallback aggregates.

Incoming clients may send `x-request-id` when it is UUID-shaped; otherwise the
server generates one.

## Weather + proxy

- Weather Runtime emits `"kind":"weather_request"` on fetch / cache / error.
- When `APP_ACCESS_CODE` is set, `proxy.ts` emits `"kind":"api_request"` with
  `source:"proxy"` for allow / lock / misconfig decisions (no secrets).
