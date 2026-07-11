/**
 * AI Runtime v2 — OpenAI budget guard (RFC-014A).
 *
 * The OpenAI account is intentionally tiny ($5). This guard tracks *estimated*
 * OpenAI spend (from token usage × the model price table) and, when the hard
 * stop is reached, marks OpenAI unavailable so routing falls back to Gemini —
 * **Gemini is never disabled**. Spend is process-local + best-effort (it resets
 * on restart); the dashboard labels it "estimated".
 *
 * Pure: `evaluateBudget` is a function of spend + config. The spend figure is
 * supplied by the caller (the runtime sums OpenAI cost from its metrics).
 */

type Env = Record<string, string | undefined>;

export interface BudgetConfig {
  monthlyBudgetUsd: number;
  softAlertUsd: number;
  hardStopUsd: number;
}

export interface BudgetStatus {
  provider: "openai";
  spentUsd: number;
  monthlyBudgetUsd: number;
  softAlertUsd: number;
  hardStopUsd: number;
  softAlertReached: boolean;
  hardStopReached: boolean;
  /** False once the hard stop is hit → the runtime skips OpenAI. */
  available: boolean;
  /** Spend is estimated from tokens × price table, reset on restart. */
  estimated: true;
}

export const DEFAULT_BUDGET: BudgetConfig = {
  monthlyBudgetUsd: 5,
  softAlertUsd: 2,
  hardStopUsd: 5,
};

function num(value: string | undefined, fallback: number): number {
  const n = value === undefined ? NaN : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function loadBudgetConfig(env: Env = process.env): BudgetConfig {
  return {
    monthlyBudgetUsd: num(env.OPENAI_MONTHLY_BUDGET_USD, DEFAULT_BUDGET.monthlyBudgetUsd),
    softAlertUsd: num(env.OPENAI_SOFT_ALERT_USD, DEFAULT_BUDGET.softAlertUsd),
    hardStopUsd: num(env.OPENAI_HARD_STOP_USD, DEFAULT_BUDGET.hardStopUsd),
  };
}

/** Evaluate OpenAI availability against estimated spend. Pure. */
export function evaluateBudget(spentUsd: number, config: BudgetConfig): BudgetStatus {
  const hardStopReached = spentUsd >= config.hardStopUsd;
  return {
    provider: "openai",
    spentUsd: Math.round(spentUsd * 1e6) / 1e6,
    monthlyBudgetUsd: config.monthlyBudgetUsd,
    softAlertUsd: config.softAlertUsd,
    hardStopUsd: config.hardStopUsd,
    softAlertReached: spentUsd >= config.softAlertUsd,
    hardStopReached,
    available: !hardStopReached,
    estimated: true,
  };
}
