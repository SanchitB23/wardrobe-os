/**
 * Intelligence Center (RFC-015) — Priority Engine.
 *
 * Scores each candidate's final impact, buckets its priority, dedupes, and ranks
 * — producing the ordered {@link ActionCard} list. Pure; no I/O, no new verdicts.
 */

import type { ActionCandidate, ActionCard } from "@/domain/intelligence/ActionTypes";
import { SOURCE_RELIABILITY, computeImpact, priorityFor } from "@/domain/intelligence/ImpactScoring";
import { dedupe, rank, subjectKey } from "@/domain/intelligence/ActionRanking";

/** Turn one candidate into a fully-scored card. */
function scoreCandidate(candidate: ActionCandidate): ActionCard {
  const impact = computeImpact(candidate.provisionalImpact, candidate.source, candidate.confidence);
  return {
    id: subjectKey(candidate.type, candidate.subject),
    type: candidate.type,
    subject: candidate.subject,
    priority: priorityFor(impact),
    impact,
    confidence: candidate.confidence,
    reason: candidate.reason,
    reasonCodes: [...candidate.reasonCodes],
    sources: [candidate.source],
    href: candidate.href,
    debug: {
      provisionalImpact: candidate.provisionalImpact,
      sourceReliability: SOURCE_RELIABILITY[candidate.source] ?? 0.7,
      dedupedFrom: 1,
    },
  };
}

/** Score → dedupe → rank (uncapped). Deterministic. */
export function prioritize(candidates: ActionCandidate[]): ActionCard[] {
  const scored = candidates.map(scoreCandidate);
  return rank(dedupe(scored));
}
