/**
 * ExecutionContext (RFC-005) — the shared, read-only context every capability
 * draws its slice from. It wraps the assembled {@link RecommendationContext}
 * (which already carries the wardrobe/usage/health/preferences snapshots) plus
 * the raw analytics + wardrobe the composing engines need, and per-request
 * inputs.
 *
 * Context layering: RecommendationContext → ExecutionContext → CapabilityContext
 * → Engine. Pure — assembled by a service from repositories; the orchestrator
 * itself performs no I/O.
 */

import type { CapabilityInputs } from "@/domain/orchestrator/Capability";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import type { UsageAnalytics } from "@/domain/analytics/UsageAnalyticsEngine";
import type { RecommendationContext } from "@/domain/recommendation";
import type { StyleDNAItem } from "@/domain/style-dna";
import type { PurchaseAnalytics } from "@/types/wardrobe";

export interface ExecutionContext {
  /** ISO timestamp — drives all time math and report metadata. */
  generatedAt: string;
  /** The assembled recommendation context (wardrobe + usage + health + preferences). */
  recommendation: RecommendationContext;
  /** Active wardrobe as StyleDNA-derivable items (for acquisition scoring). */
  wardrobe: StyleDNAItem[];
  /** Raw analytics (for capabilities that need the full objects, e.g. insights). */
  health: WardrobeHealth | null;
  usage: UsageAnalytics | null;
  purchase: PurchaseAnalytics | null;
  /** Per-request inputs (occasion, prospective item, vision analysis, …). */
  inputs: CapabilityInputs;
}

export interface CreateExecutionContextArgs {
  recommendation: RecommendationContext;
  wardrobe?: StyleDNAItem[];
  health?: WardrobeHealth | null;
  usage?: UsageAnalytics | null;
  purchase?: PurchaseAnalytics | null;
  inputs?: CapabilityInputs;
  generatedAt?: string;
}

/** Package assembled data into an ExecutionContext. Pure; time injected. */
export function createExecutionContext(args: CreateExecutionContextArgs): ExecutionContext {
  return {
    generatedAt: args.generatedAt ?? args.recommendation.generatedAt ?? new Date().toISOString(),
    recommendation: args.recommendation,
    wardrobe: args.wardrobe ?? [],
    health: args.health ?? null,
    usage: args.usage ?? null,
    purchase: args.purchase ?? null,
    inputs: args.inputs ?? {},
  };
}
