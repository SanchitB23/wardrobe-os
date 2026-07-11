/**
 * RuntimeBudgetMonitor (RFC-014B) — the OpenAI spend guard, as an object with a
 * live spend source. Wraps the pure `evaluateBudget` (RFC-014A `BudgetGuard`)
 * and answers "is this provider currently available?" for the router.
 *
 * Only OpenAI is gated by the budget; Gemini (and any other provider) is always
 * available — budget awareness must never block the default runtime. No billing
 * APIs; spend is the injected best-effort estimate.
 */

import { evaluateBudget, type BudgetConfig, type BudgetStatus } from "@/runtime/ai/BudgetGuard";
import type { AIProviderId } from "@/ai/types";

export class RuntimeBudgetMonitor {
  constructor(
    private readonly config: BudgetConfig,
    /** Returns estimated OpenAI month-to-date spend (USD). */
    private readonly spendSource: () => number,
  ) {}

  /** Current budget status (drives the hard stop + the dashboard). */
  status(): BudgetStatus {
    return evaluateBudget(this.spendSource(), this.config);
  }

  /** OpenAI is unavailable once the hard stop trips; all others stay available. */
  isProviderAvailable(provider: AIProviderId): boolean {
    return provider === "openai" ? this.status().available : true;
  }
}
