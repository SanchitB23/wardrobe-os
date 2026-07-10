/**
 * Recommendation Engine v2 (RFC-012) — Diversity Reranking.
 *
 * Guarantees the returned top-K are meaningfully different: not the same outfit
 * skeleton, dominant colour palette, or footwear repeatedly. Deterministic greedy
 * selection — walk candidates by score, admit one only if it differs from the
 * already-admitted on enough axes; relax the threshold step by step if the list
 * would otherwise fall short (so a thin wardrobe still returns a full list). No
 * randomness. Pure.
 */

import type { OutfitSlot } from "@/types/wardrobe";
import type { WardrobeItemSnapshot } from "@/domain/recommendation/RecommendationContext";
import type { DiversityDecision } from "@/domain/recommendation/v2/types";
import type { ScoredCandidate } from "@/domain/recommendation/v2/ScoringEngine";
import { DIVERSITY } from "@/domain/recommendation/v2/RecommendationWeights";

function normalize(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function slotItem(scored: ScoredCandidate, slot: OutfitSlot): WardrobeItemSnapshot | undefined {
  return scored.candidate.snapshots.find((i) => i.styleDNA.slot === slot);
}

function footwearClass(item: WardrobeItemSnapshot | undefined): string {
  if (!item) return "none";
  const h = normalize(`${item.name} ${item.subcategory ?? ""}`);
  if (["oxford", "derby", "brogue", "loafer", "monk", "dress"].some((k) => h.includes(k))) return "dress";
  if (["sneaker", "trainer", "running", "court", "canvas", "air force", "af1", "574"].some((k) => h.includes(k))) return "sneaker";
  if (["boot", "chukka", "chelsea"].some((k) => h.includes(k))) return "boot";
  if (["sandal", "slide", "flip"].some((k) => h.includes(k))) return "sandal";
  return `f-${item.formality ?? "na"}`;
}

/** Most common colour family across the outfit's items (the dominant palette). */
function dominantPalette(scored: ScoredCandidate): string {
  const counts = new Map<string, number>();
  for (const item of scored.candidate.snapshots) {
    const family = normalize(item.colorFamily ?? item.styleDNA.color.family);
    if (!family) continue;
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  let best = "";
  let bestCount = -1;
  // Deterministic tie-break by family name.
  for (const family of [...counts.keys()].sort()) {
    const count = counts.get(family)!;
    if (count > bestCount) {
      best = family;
      bestCount = count;
    }
  }
  return best;
}

function skeleton(scored: ScoredCandidate): string {
  const top = slotItem(scored, "top");
  const bottom = slotItem(scored, "bottom");
  return `${top?.id ?? ""}|${bottom?.id ?? ""}|${footwearClass(slotItem(scored, "footwear"))}`;
}

interface Axes {
  skeleton: string;
  palette: string;
  footwear: string;
}

function axesOf(scored: ScoredCandidate): Axes {
  return {
    skeleton: skeleton(scored),
    palette: dominantPalette(scored),
    footwear: footwearClass(slotItem(scored, "footwear")),
  };
}

/** Number of axes (0–3) on which two candidates DIFFER. */
function distance(a: Axes, b: Axes): number {
  let d = 0;
  if (a.skeleton !== b.skeleton) d += 1;
  if (a.palette !== b.palette) d += 1;
  if (a.footwear !== b.footwear) d += 1;
  return d;
}

export interface RerankResult {
  reranked: ScoredCandidate[];
  decisions: Map<string, DiversityDecision>;
  /** 0–1 — mean pairwise distance among the returned list, normalized by 3. */
  diversityScore: number;
}

/**
 * Reranks the (already score-sorted) candidates for diversity, returning up to
 * `limit`. Deterministic.
 */
export function rerankForDiversity(
  sorted: readonly ScoredCandidate[],
  limit: number,
  opts: { minDistinctAxes?: number } = {},
): RerankResult {
  const remaining = sorted.map((scored) => ({ scored, axes: axesOf(scored) }));
  const admitted: { scored: ScoredCandidate; axes: Axes }[] = [];
  const decisions = new Map<string, DiversityDecision>();

  // RFC-013: explore/exploit can nudge the diversity threshold (clamped 0–3).
  const baseThreshold = Math.max(
    0,
    Math.min(3, opts.minDistinctAxes ?? DIVERSITY.minDistinctAxes),
  );
  let threshold = baseThreshold;
  let everRelaxed = false;

  while (admitted.length < limit && remaining.length > 0) {
    let idx = remaining.findIndex(({ axes }) =>
      admitted.every((a) => distance(axes, a.axes) >= threshold),
    );
    let relaxedHere = false;
    if (idx === -1) {
      if (threshold > 0) {
        threshold -= 1;
        everRelaxed = true;
        continue;
      }
      idx = 0; // threshold 0 admits anything — take the best remaining.
    }
    if (threshold < baseThreshold) relaxedHere = true;

    const [chosen] = remaining.splice(idx, 1);
    const distinctFrom = admitted
      .filter((a) => distance(chosen.axes, a.axes) >= DIVERSITY.minDistinctAxes)
      .map((a) => a.scored.candidate.id);
    admitted.push(chosen);
    decisions.set(chosen.scored.candidate.id, {
      rank: admitted.length,
      distinctFrom,
      heldBackNearDuplicates: 0, // filled below
      relaxed: relaxedHere || everRelaxed,
    });
  }

  // Count near-duplicates held back behind each admitted (debug metric).
  for (const { scored, axes } of remaining) {
    void scored;
    let nearestId: string | null = null;
    let nearestDist = Infinity;
    for (const a of admitted) {
      const d = distance(axes, a.axes);
      if (d < nearestDist) {
        nearestDist = d;
        nearestId = a.scored.candidate.id;
      }
    }
    if (nearestId != null && nearestDist < DIVERSITY.minDistinctAxes) {
      const decision = decisions.get(nearestId);
      if (decision) decision.heldBackNearDuplicates += 1;
    }
  }

  // Diversity score: mean pairwise distance / 3.
  let diversityScore = 1;
  if (admitted.length >= 2) {
    let sum = 0;
    let pairs = 0;
    for (let i = 0; i < admitted.length; i += 1) {
      for (let j = i + 1; j < admitted.length; j += 1) {
        sum += distance(admitted[i].axes, admitted[j].axes);
        pairs += 1;
      }
    }
    diversityScore = pairs > 0 ? Math.round((sum / pairs / 3) * 100) / 100 : 1;
  }

  return {
    reranked: admitted.map((a) => a.scored),
    decisions,
    diversityScore,
  };
}
