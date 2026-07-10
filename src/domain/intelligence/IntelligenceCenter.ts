/**
 * Intelligence Center (RFC-015) — the entry point.
 *
 * Aggregates every deterministic engine's output (as normalized sources) into one
 * ranked, deduplicated list of typed actions. Engines decide; the Center
 * aggregates + ranks; AI explains (ADR-005). Pure and deterministic: same sources
 * + generatedAt ⇒ identical TopActions.
 */

import type {
  ActionSource,
  IntelligenceCenterOptions,
  IntelligenceCenterResult,
  IntelligenceSources,
} from "@/domain/intelligence/ActionTypes";
import { generateActions } from "@/domain/intelligence/ActionGenerator";
import { INTELLIGENCE_ENGINE_VERSION } from "@/domain/intelligence/ImpactScoring";
import { prioritize } from "@/domain/intelligence/PriorityEngine";

const DEFAULT_TOP_N = 7;

export function buildIntelligenceCenter(
  sources: IntelligenceSources,
  options: IntelligenceCenterOptions = {},
): IntelligenceCenterResult {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const topN = options.topN ?? DEFAULT_TOP_N;

  const candidates = generateActions(sources);
  const ranked = prioritize(candidates);
  const topActions = ranked.slice(0, topN);

  const bySource: Partial<Record<ActionSource, number>> = {};
  for (const candidate of candidates) {
    bySource[candidate.source] = (bySource[candidate.source] ?? 0) + 1;
  }

  return {
    topActions,
    generatedAt,
    metadata: {
      engineVersion: INTELLIGENCE_ENGINE_VERSION,
      candidateCount: candidates.length,
      dedupedCount: ranked.length,
      bySource,
    },
  };
}
