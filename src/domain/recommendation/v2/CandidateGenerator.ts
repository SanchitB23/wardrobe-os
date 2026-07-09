/**
 * Recommendation Engine v2 (RFC-012) — Candidate Generation.
 *
 * Produces the unified candidate list by **reusing the existing engines** — it
 * does NOT re-implement outfit generation. Saved outfits come from
 * {@link generateOutfitRecommendations}; fresh combinations from
 * {@link generateOutfits}. Both are normalized into one {@link OutfitCandidate}
 * shape carrying the resolved item snapshots so downstream stages never touch
 * the wardrobe again. Pure and deterministic.
 */

import { generateOutfitRecommendations } from "@/domain/recommendation/OutfitRecommendationEngine";
import { generateOutfits } from "@/domain/generation/OutfitGenerationEngine";
import type { RecommendedOutfitItem } from "@/domain/recommendation/OutfitRecommendationEngine";
import type {
  RecommendationContext,
  WardrobeItemSnapshot,
} from "@/domain/recommendation/RecommendationContext";
import type { OutfitCandidate } from "@/domain/recommendation/v2/types";
import { PER_SOURCE_LIMIT } from "@/domain/recommendation/v2/RecommendationWeights";

function itemSetKey(items: readonly RecommendedOutfitItem[]): string {
  return items
    .map((item) => item.itemId)
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

/**
 * Builds the unified candidate list for `context`. Saved and generated outfits
 * are merged on one list; exact item-set duplicates across the two sources are
 * de-duplicated, preferring the saved candidate. Deterministic.
 */
export function generateCandidates(
  context: RecommendationContext,
  options: { occasion?: string | null } = {},
): OutfitCandidate[] {
  const byId = new Map(context.wardrobe.items.map((item) => [item.id, item]));
  const resolve = (items: readonly RecommendedOutfitItem[]): WardrobeItemSnapshot[] =>
    items
      .map((item) => byId.get(item.itemId))
      .filter((snap): snap is WardrobeItemSnapshot => Boolean(snap));

  const favoriteByOutfit = new Map(
    context.savedOutfits.outfits.map((o) => [o.id, o.favorite]),
  );
  const lastWornByOutfit = new Map(
    context.savedOutfits.outfits.map((o) => [o.id, o.lastWornOn]),
  );

  const occasion = options.occasion ?? null;

  // 1. Saved-outfit candidates (the saved engine also emits generated fillers;
  //    we only take the saved ones here — generation is handled separately so
  //    the two sources are directly comparable).
  const savedResult = generateOutfitRecommendations(context, {
    occasion,
    limit: PER_SOURCE_LIMIT,
  });
  const saved: OutfitCandidate[] = savedResult.recommendations
    .filter((rec) => rec.metadata.source === "saved_outfit")
    .map((rec) => ({
      id: `saved:${rec.outfitId ?? itemSetKey(rec.items)}`,
      source: "saved_outfit" as const,
      savedOutfitId: rec.outfitId,
      name: rec.name,
      items: rec.items,
      snapshots: resolve(rec.items),
      analysis: rec.analysis,
      rawScore: rec.score,
      confidence: rec.confidence,
      favorite: rec.outfitId ? Boolean(favoriteByOutfit.get(rec.outfitId)) : false,
      lastWornOn: rec.outfitId ? (lastWornByOutfit.get(rec.outfitId) ?? null) : null,
      strengths: rec.strengths,
      tradeoffs: rec.tradeoffs,
      suggestions: rec.suggestions,
    }));

  // 2. Generated-combo candidates.
  const generated: OutfitCandidate[] = generateOutfits(context, {
    occasion,
    limit: PER_SOURCE_LIMIT,
  }).map((gen, index) => {
    const items: RecommendedOutfitItem[] = Object.values(gen.items)
      .filter((ref): ref is NonNullable<typeof ref> => Boolean(ref))
      .map((ref) => ({
        itemId: ref.itemId,
        name: ref.name,
        slot: ref.slot,
        category: ref.category,
      }));
    const [, ...rest] = gen.reasoning;
    return {
      id: `generated:${itemSetKey(items)}:${index}`,
      source: "generated_combo" as const,
      name: `${gen.items.top.name} + ${gen.items.bottom.name}`,
      items,
      snapshots: resolve(items),
      analysis: gen.analysis,
      rawScore: gen.score,
      confidence: gen.confidence,
      favorite: false,
      lastWornOn: null,
      strengths: [...rest, ...gen.analysis.strengths].slice(0, 4),
      tradeoffs: gen.analysis.weaknesses.slice(0, 3),
      suggestions: gen.analysis.suggestions.slice(0, 3),
    } satisfies OutfitCandidate;
  });

  // 3. De-duplicate exact item sets across sources, preferring saved.
  const seen = new Set<string>();
  const merged: OutfitCandidate[] = [];
  for (const candidate of [...saved, ...generated]) {
    const key = itemSetKey(candidate.items);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(candidate);
  }
  return merged;
}
