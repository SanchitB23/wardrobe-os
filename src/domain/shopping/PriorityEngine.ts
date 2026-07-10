/**
 * PriorityEngine (RFC-018) — pure. Derives the **Need Score** from wardrobe gaps,
 * combines Need + Impact + Buy into a **Priority Score**, and ranks the wishlist.
 * It orders the queue; it never decides a purchase (Acquisition does that).
 */

import type { ProspectiveItem } from "@/domain/acquisition";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import {
  DEFAULT_PRIORITY_WEIGHTS,
  NEED_BASELINE,
  NEED_BY_GAP_PRIORITY,
  NEED_NEUTRAL,
} from "@/domain/shopping/constants";
import type {
  PriorityWeights,
  ShoppingRecommendation,
  ShoppingScores,
} from "@/domain/shopping/types";

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

function tokenize(...parts: (string | null | undefined)[]): Set<string> {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const word of part.toLowerCase().split(/[^a-z0-9]+/)) {
      if (word.length >= 3) tokens.add(word);
    }
  }
  return tokens;
}

/**
 * How badly this item fills a real wardrobe gap (0–100). Matches the item's
 * category/subcategory/name tokens against the health gaps and scores by the
 * highest-priority matching gap; no match ⇒ baseline; no health ⇒ neutral.
 */
export function computeNeedScore(
  item: ProspectiveItem,
  health: WardrobeHealth | null,
): number {
  if (!health) return NEED_NEUTRAL;
  const itemTokens = tokenize(item.category, item.subcategory, item.name);
  if (itemTokens.size === 0) return NEED_BASELINE;

  let best = NEED_BASELINE;
  for (const gap of health.gaps) {
    const gapTokens = tokenize(gap.label, gap.detail);
    let matches = false;
    for (const token of itemTokens) {
      if (gapTokens.has(token)) {
        matches = true;
        break;
      }
    }
    if (matches) best = Math.max(best, NEED_BY_GAP_PRIORITY[gap.priority]);
  }
  return best;
}

/** Combine Need + Impact + Buy (all 0–100) into a priority score + reason codes. */
export function priorityScore(
  parts: { need: number; impact: number; buy: number },
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS,
): { score: number; reasonCodes: string[] } {
  const total = weights.need + weights.impact + weights.buy || 1;
  const score = clamp100(
    Math.round(
      (parts.need * weights.need + parts.impact * weights.impact + parts.buy * weights.buy) /
        total,
    ),
  );

  const reasonCodes: string[] = [];
  if (parts.need >= 70) reasonCodes.push("NEED_HIGH");
  else if (parts.need <= NEED_BASELINE) reasonCodes.push("NEED_LOW");
  if (parts.impact >= 60) reasonCodes.push("IMPACT_HIGH");
  if (parts.buy >= 70) reasonCodes.push("BUY_STRONG");
  else if (parts.buy < 40) reasonCodes.push("BUY_WEAK");

  return { score, reasonCodes };
}

/** Assemble the full score bundle for one entry. */
export function scoreEntry(
  item: ProspectiveItem,
  buy: number,
  impact: number,
  health: WardrobeHealth | null,
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS,
): ShoppingScores {
  const need = computeNeedScore(item, health);
  const { score, reasonCodes } = priorityScore({ need, impact, buy }, weights);
  return { need, impact, buy, priority: score, reasonCodes };
}

/** Rank a queue by priority (desc), with deterministic tie-breaks. */
export function rankWishlist(entries: ShoppingRecommendation[]): ShoppingRecommendation[] {
  return [...entries].sort((a, b) => {
    if (b.scores.priority !== a.scores.priority) return b.scores.priority - a.scores.priority;
    if (b.scores.buy !== a.scores.buy) return b.scores.buy - a.scores.buy;
    if (b.scores.impact !== a.scores.impact) return b.scores.impact - a.scores.impact;
    return a.id.localeCompare(b.id);
  });
}
