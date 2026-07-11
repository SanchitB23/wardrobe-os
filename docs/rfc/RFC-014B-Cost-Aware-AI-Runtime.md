# RFC-014B: Cost-Aware AI Runtime

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Claude (Opus 4.8)
Target Release: v1.1.x
Epic: Runtime
Priority: High
Effort: M
Dependencies:
- RFC-014 AI Runtime v2 (`src/runtime/ai`) — capability routing, provider policies, fallback, metrics, benchmarking shell it builds on
- RFC-014A OpenAI Provider Integration — the real `OpenAIProvider` (`src/ai/providers/openai-provider.ts`) this RFC routes to selectively
- ADR-004 (provider abstraction), ADR-005 (AI does not decide), ADR-006 (AI cache), ADR-008 (release/versioning)

> **Formalises the cost-first routing policy** of the AI Runtime. RFC-014 made
> the provider an interchangeable runtime detail; RFC-014A wired a real OpenAI
> provider. This RFC specifies *how the runtime chooses* — provider **and model**
> — per capability, optimising for **maximum value per rupee**: Gemini stays the
> everyday default, OpenAI is an optimization layer for tasks where it clearly
> wins, and a soft budget guard keeps a tiny OpenAI account safe.

> **Status note:** the routing *policy* shipped with RFC-014A
> (`ProviderPolicy.ts`, `ModelPolicy.ts`, `BudgetGuard.ts`). RFC-014B then
> **implemented the decision layer** that formalises it — a `RuntimePolicyResolver`
> composing `CapabilityPolicy`, `ModelPolicy`, `ProviderPreferenceResolver`,
> `RuntimeCostEstimator`, and `RuntimeBudgetMonitor` (all in `src/runtime/ai`) —
> so `AIRuntime` delegates all routing decisions to one testable place. Provider
> implementations and deterministic engines were not touched.

---

## Cost-Aware Runtime Philosophy

Same spirit as the rest of Wardrobe OS, applied to *how AI is called*:

- **Cheapest model that satisfies the capability.** Not "best model everywhere."
  A task's model is the smallest one that clears its quality bar.
- **Deterministic engines first.** Scoring/eligibility/ranking never touch AI
  (ADR-005). Cost policy governs *narration/understanding*, never decisions.
- **AI explains.** The runtime routes and measures; it never decides.
- **Gemini remains the default runtime.** Everyday interactions are Gemini.
- **OpenAI is an optimization layer.** Used only where it meaningfully improves
  quality (structured JSON, classification), always with a Gemini fallback.

## 1. Problem Statement

RFC-014 introduced a provider abstraction; RFC-014A made OpenAI real. But the
mental model was still **provider-centric** — "pick a primary provider" — and the
first cut even leaned OpenAI-primary for text. For a **single-user personal
project on a small OpenAI budget**, that is the wrong optimisation:

- **One provider is rarely best for every task.** Gemini Flash is excellent (and
  far cheaper) for conversation/explanation/vision; OpenAI's small models are
  strong at strict JSON and short classification. A single primary wastes money
  or quality.
- **Model choice was coupled to provider choice.** Picking "OpenAI" didn't say
  *which* OpenAI model — and the premium model must never be reached for by
  accident.
- **No spend awareness.** Nothing estimated OpenAI usage or protected a $5 cap; an
  accidental default could exhaust it.

We need the runtime to optimise for **value per rupee**: choose the provider *and*
the cheapest adequate model **per capability**, keep Gemini as the default, treat
OpenAI as a premium optimization, and stay inside a soft budget — without ever
interrupting deterministic business logic.

## 2. Goals

- **Model policies** — resolve a concrete model per (capability, provider),
  separate from provider selection.
- **Capability-specific routing** — each capability picks its own provider, not a
  global primary.
- **Cost awareness** — estimate per-call and month-to-date cost from token usage.
- **Runtime budgeting** — a soft OpenAI budget with soft-alert + hard-stop.
- **Gemini default** — conversation / explanation / summarization / vision stay
  Gemini-first.
- **OpenAI as optimization** — used only where it clearly helps (structured,
  classification), always with a Gemini fallback.

## 3. Non-Goals

- **No pricing APIs.** Costs come from a static, hand-maintained price table
  (directional, not billed).
- **No billing integration / no OpenAI account management.** No keys minted, no
  invoices read, no usage synced from the provider.
- **No provider-specific business logic.** Providers stay behind the
  vendor-neutral `AIProvider` interface; capabilities/policies are provider-neutral.
- **No change to deterministic engines.** Recommendation / acquisition /
  personalization scoring is untouched.
- **No premium-by-default.** GPT-5.5 is never auto-selected (see §Model Policy).

## 4. User Stories

- As the owner, everyday chat/explanations run on Gemini (cheap, fast) without my
  thinking about providers.
- As the owner, structured extraction and classification quietly use OpenAI's
  small models when they're better — but fall back to Gemini if my key is unset.
- As the owner, if my $5 OpenAI budget is exhausted, the app keeps working on
  Gemini — nothing breaks.
- As a developer, I can see per-capability provider + model + cost and month-to-date
  OpenAI spend in the AI Runtime dashboard.
- As a developer, I can override any capability's route with an env var, and I can
  roll back to Gemini-only in one switch.

## 5. UX Flow

No end-user UX. Developer-facing only, at **`/developer/ai-runtime`** (gated by
Developer Mode):

1. **Capability routing table** — capability → provider → **model** (+ fallback
   provider/model).
2. **OpenAI budget card** — estimated month-to-date spend, soft-alert / hard-stop
   thresholds, monthly budget, and **available / unavailable** state (labelled
   "estimated / best-effort").
3. **Runtime metrics** — per capability × provider × prompt version: requests,
   cache hits, failures, latency, tokens, estimated cost.

Configuration is env-only (`AI_POLICY_*`, `OPENAI_MODEL_*`, `OPENAI_*_USD`); no UI
to edit policy.

## 6. Architecture

The resolution chain is **capability → provider policy → provider → model policy →
model**, with a budget guard gating OpenAI and a fallback chain underneath. All
pure/deterministic except the provider call itself.

```
AIRuntimeRequest { capability }
      ↓ CapabilityRouter.resolveProvider(capability)      → ProviderPolicy { primary, fallback }
      ↓ ModelPolicy.resolveModel(capability, provider)    → concrete model id (per provider)
      ↓ BudgetGuard.evaluateBudget(openaiSpend, config)   → isAvailable(openai)?
      ↓ ProviderRouter.route(policy, mechanical, req, { resolveModel, isAvailable })
            primary (with retry) → fallback
      ↓ provider.generate()/vision()  (Gemini | OpenAI)   ← real SDKs, server-side
      ↓ RuntimeMetrics.record(latency, tokens, estCost, servedBy, cacheHit)
      ↓ AIRuntimeResult { text, servedBy, usedFallback, costUsd, … }
```

### Layers (as shipped with RFC-014A; this RFC documents them)
- **Provider policy** (`src/runtime/ai/ProviderPolicy.ts`) — `DEFAULT_POLICIES`
  (cost-first, below) + `GEMINI_ONLY_POLICIES` (rollback) + `loadPolicies(env)`
  applying `AI_POLICY_<CAPABILITY>=primary,fallback` overrides.
- **Model policy** (`src/runtime/ai/ModelPolicy.ts`) — `resolveModel(capability,
  provider, env)`; OpenAI models by capability (nano/mini), premium never default.
- **Budget guard** (`src/runtime/ai/BudgetGuard.ts`) — `loadBudgetConfig(env)` +
  pure `evaluateBudget(spend, config)`; the runtime sums OpenAI cost from metrics.
- **Router** (`ProviderRouter`) — per-provider model resolution + an `isAvailable`
  predicate (skips OpenAI when the hard stop trips), then primary → fallback.
- **Metrics** (`RuntimeMetrics`) — latency/tokens/cost per capability × provider.
- **Providers** — `GeminiProvider`, `OpenAIProvider` real; `ClaudeProvider` stub.

## 7. Data Flow

```
run({ capability, request })
  → policy   = resolveProvider(capability, policies)         // capability routing
  → budget   = evaluateBudget(openAiSpendUsd(), budgetCfg)   // budget awareness
  → isAvailable(id) = id==="openai" ? budget.available : true // OpenAI gated only
  → resolveModelFor(id) = resolveModel(capability, id, env)  // model routing
  → route(policy, mechanical, request, { resolveModel, isAvailable })
       primary → (retry) → fallback                          // fallback routing
  → record(latency, usage, estCost, servedBy)                // metrics + cost
  → result { servedBy, usedFallback, costUsd }
```

Deterministic given (capability, request, env, current spend). The only I/O is the
chosen provider's SDK call.

## 8. Data Model / Schema Impact

**None.** No database tables, no persisted state. Policies + budget come from env;
spend is process-local, best-effort, and resets on restart (documented as
"estimated"). No migration.

## 9. API / Domain Contracts

Illustrative; matches the shipped runtime.

```ts
type AICapability =
  | "conversation" | "explanation" | "summarization"
  | "structured" | "classification"
  | "vision" | "image_generation" | "embeddings"; // embeddings reserved

interface ProviderPolicy { primary: AIProviderId; fallback?: AIProviderId; model?: string }
type AIRuntimePolicies = Record<AICapability, ProviderPolicy>;

// Model policy — capability × provider → model id (undefined ⇒ provider default).
function resolveModel(capability: AICapability, provider: AIProviderId, env?): string | undefined;

// Budget guard — pure evaluation over estimated spend.
interface BudgetConfig { monthlyBudgetUsd: number; softAlertUsd: number; hardStopUsd: number }
interface BudgetStatus { spentUsd: number; softAlertReached: boolean; hardStopReached: boolean; available: boolean; estimated: true; /* + thresholds */ }
function loadBudgetConfig(env?): BudgetConfig;
function evaluateBudget(spentUsd: number, config: BudgetConfig): BudgetStatus;

// Runtime surface used by the dashboard.
class AIRuntime {
  run<T>(req): Promise<AIRuntimeResult<T>>;      // servedBy, usedFallback, costUsd
  modelFor(capability, provider): string | undefined;
  budgetStatus(): BudgetStatus;
  metricsSnapshot(): AIRuntimeMetricsSnapshot;
}
```

### Recommended Default Policy (provider routing)

| Capability | Primary | Fallback |
| --- | --- | --- |
| Conversation | Gemini | OpenAI |
| Explanation | Gemini | OpenAI |
| Summarization | Gemini | OpenAI |
| Structured Output | **OpenAI** | Gemini |
| Classification | **OpenAI** | Gemini |
| Vision | Gemini | — (Gemini only) |
| Image Generation | OpenAI | Gemini |
| Embeddings (future) | Gemini | — |

Override any row with `AI_POLICY_<CAPABILITY>=primary,fallback`. `GEMINI_ONLY_POLICIES`
flips everything to Gemini for zero OpenAI spend.

> **"OpenAI-first for Structured Output" is a configurable default policy, not a
> permanent architectural rule.** It reflects today's belief that OpenAI's small
> models produce more reliable strict JSON — a tunable assumption, not a
> constraint. The architecture is provider-neutral: any capability (structured
> included) can be repointed to Gemini-first (e.g. `AI_POLICY_STRUCTURED=gemini,openai`
> or `GEMINI_ONLY_POLICIES`) without code changes. If Gemini's JSON mode proves
> good enough (see §14.3), the *default* can flip with no architectural impact.

### Model Policy

| Provider | Use | Model | Env |
| --- | --- | --- | --- |
| Gemini | Conversation / Explanation / Vision | Gemini Flash | `GEMINI_MODEL` |
| OpenAI | Structured output | GPT-5.4 Mini | `OPENAI_MODEL_STRUCTURED` |
| OpenAI | Classification / routing | GPT-5.4 Nano | `OPENAI_MODEL_CLASSIFIER` |
| OpenAI | Text (conversation/explanation fallback) | GPT-5.4 Mini | `OPENAI_MODEL_TEXT` |
| OpenAI | **Premium** | GPT-5.5 | `OPENAI_MODEL_PREMIUM` |

**GPT-5.5 is never selected automatically.** Only an explicit per-call model
override or a future High Quality Mode may use it.

## 10. Acceptance Criteria

This RFC is complete when it documents (it does):

- [ ] **Capability routing** — each capability resolves its own provider policy.
- [ ] **Model routing** — capability × provider → concrete model, separate from
      provider selection; premium never auto-selected.
- [ ] **Budget philosophy** — estimate OpenAI spend; soft-alert + hard-stop;
      never interrupts deterministic logic; OpenAI unavailable ⇒ Gemini.
- [ ] **Gemini-first strategy** — Gemini default for everyday capabilities;
      OpenAI as an optimization layer.
- [ ] **Provider fallback** — primary → fallback documented, incl. the
      missing-key and hard-stop paths.
- [ ] Non-goals, risks, open questions.
- [ ] **No implementation** in this RFC.

## 11. QA / Testing Plan

(Validation targets for the shipped behaviour this RFC formalises.)

- **Provider routing** — Gemini primary for conversation/explanation/summarization/
  vision; OpenAI primary (Gemini fallback) for structured/classification.
- **Model routing** — classification → nano, structured/text → mini, Gemini →
  `GEMINI_MODEL`; premium never returned by default.
- **Budget** — `evaluateBudget` soft-alert + hard-stop thresholds; hard stop marks
  OpenAI unavailable → Gemini fallback; Gemini never blocked.
- **Fallback** — missing `OPENAI_API_KEY` ⇒ OpenAI unavailable ⇒ Gemini serves.
- **Metrics** — provider, model, tokens, latency, estimated cost recorded.
- **Determinism guard** — cost/budget logic never affects engine scoring.
- **Release gate** — `npm test`, `npm run lint`, `npm run build` green (ADR-008).

## 12. Risks & Trade-offs

- **Estimated (not billed) spend.** The price table is hand-maintained and
  process-local; the guard can drift from real billing. *Mitigation:* label it
  "estimated / best-effort", keep the table easy to update, set the hard stop
  conservatively below the real cap.
- **Cross-provider fallback + model mismatch.** A fallback uses a *different*
  provider's model. *Mitigation:* the model policy resolves per-provider at route
  time (not a single shared model id).
- **Quality regressions from cheaper models.** Nano/Mini may underperform on some
  tasks. *Mitigation:* per-capability overrides + a future High Quality Mode; the
  fallback still catches hard failures.
- **Spend resets on restart.** A long-lived process is assumed; frequent restarts
  under-count spend. *Mitigation:* documented; a persisted counter is a future
  extension.
- **Config sprawl.** Many `AI_POLICY_*` / `OPENAI_*` envs. *Mitigation:* sane
  defaults; everything works with zero config (Gemini-only when no OpenAI key).

## 13. Future Extensions

- **High Quality Mode** — explicit opt-in that unlocks GPT-5.5 for a call/session.
- **Capability Profile (future).** Promote each capability from a flat
  provider/model policy to a richer profile describing its *requirements* along
  three axes — **Quality → Latency → Cost** — and let the runtime pick the
  provider+model that best satisfies the profile rather than a hard-coded row:

  ```
  Capability
    ↓ Quality   (required quality bar, e.g. strict-JSON reliability)
    ↓ Latency   (acceptable latency budget, e.g. interactive vs. batch)
    ↓ Cost      (cost ceiling / preference)
        → runtime selects the cheapest provider+model meeting Quality within Latency
  ```

  This makes "cheapest model that satisfies the capability" *computed* from
  declared requirements instead of a static table. Future only — the current
  runtime uses the flat policy above.
- **Dynamic routing (future).** Route by *request shape/size* within a capability,
  not just by capability: small/simple requests stay on the cheap default; large or
  complex ones escalate to a stronger model.

  ```
  Small / simple request  → Gemini (cheap default)
  Large / complex request → GPT (escalated)
  ```

  Requires a cheap, deterministic request-size/complexity heuristic feeding the
  router. Future only — today routing is per-capability, not per-request-size.
- **Persisted spend** — durable month-to-date counter (survives restarts) with a
  real month boundary.
- **Per-capability quality bars** — auto-escalate to a larger model when a cheap
  model's confidence/parse fails.
- **Claude provider** — add as a third routable provider (RFC-014A left it a stub).
- **Embeddings capability** — wire the reserved capability when a use case lands.
- **Cost dashboards over time** — trend spend/latency across restarts.

## 14. Open Questions

1. **Month boundary** — should spend reset monthly (real calendar) once persisted,
   or stay a rolling process-local estimate?
2. **Soft alert action** — surface only in the dashboard, or also log/notify a dev
   channel when the soft alert trips?
3. **Structured on Gemini** — is Gemini's JSON mode good enough to make structured
   Gemini-primary too (dropping OpenAI there) for even lower cost?
4. **High Quality Mode scope** — per-call flag, per-session toggle, or a capability
   policy variant?
5. **Fallback cost caps** — should the fallback also respect a (separate) budget,
   or is Gemini always free-enough to be unbounded?
6. **Image generation** — the policy lists OpenAI primary, but no image-gen
   provider is implemented; keep as documented intent or drop until built?
