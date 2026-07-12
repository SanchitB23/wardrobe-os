/**
 * Intelligence Center service (RFC-015) — assembles normalized sources from the
 * existing deterministic engines and runs the pure `buildIntelligenceCenter`.
 * Returns `{ data, error }`. The engines decide; this only wires their outputs
 * into the Center's normalized inputs.
 *
 * Live sources today: recommendation (Wear), health (Buy gaps / Replace
 * duplicates), usage (Rotate under-used). Acquisition / lifestyle / weather /
 * vision are contextual (need a prospective item, trip, or scan) and are fed as
 * that context becomes available — the domain already supports all eight.
 */

import { clusterCategoryKey } from "@/domain/category-optimization";
import { buildIntelligenceCenter, type IntelligenceCenterResult, type IntelligenceSources } from "@/domain/intelligence";
import type { ExploreExploitMode } from "@/domain/personalization/v2";
import { fetchWardrobeHealth, fetchUsageAnalytics } from "@/features/analytics/services/analytics.service";
import { fetchOutfitRecommendations } from "@/features/recommendations/services/recommendations.service";
import { toError } from "@/shared/utils/data-result";

const GAP_SEVERITY: Record<"high" | "medium" | "low", number> = {
  high: 0.9,
  medium: 0.6,
  low: 0.35,
};

export type IntelligenceCenterFilters = {
  exploreExploit?: ExploreExploitMode | null;
  topN?: number;
};

export async function getIntelligenceCenter(
  filters: IntelligenceCenterFilters = {},
): Promise<{ data: IntelligenceCenterResult | null; error: Error | null }> {
  const [recResult, healthResult, usageResult] = await Promise.all([
    fetchOutfitRecommendations({ exploreExploit: filters.exploreExploit ?? undefined }).catch(() => ({ data: null, error: null })),
    fetchWardrobeHealth().catch(() => ({ data: null, error: null })),
    fetchUsageAnalytics().catch(() => ({ data: null, error: null })),
  ]);

  const sources: IntelligenceSources = {};

  // Recommendation → Wear.
  const topRec = recResult.data?.recommendations?.[0];
  if (topRec) {
    sources.recommendation = {
      topOutfit: { id: topRec.id, label: topRec.name, score: topRec.score, confidence: topRec.confidence },
    };
  }

  // Health → Buy (gaps) + Replace/Optimize (duplicates).
  const health = healthResult.data?.health;
  if (health) {
    sources.health = {
      gaps: health.gaps.map((gap) => ({ label: gap.label, severity: GAP_SEVERITY[gap.priority] ?? 0.5 })),
      duplicates: health.duplicates.map((dup) => ({
        label: dup.label,
        count: dup.count,
        categoryKey: clusterCategoryKey(dup.bucket, dup.colorFamily, dup.formality),
      })),
    };
  }

  // Usage → Rotate (stale / never-worn, non-protected).
  const usage = usageResult.data;
  if (usage) {
    const underUsed = [
      ...usage.staleItems.map((item) => ({ itemId: item.id, label: item.name, stale: true })),
      ...usage.neverWornItems.map((item) => ({ itemId: item.id, label: item.name, stale: false })),
    ];
    if (underUsed.length > 0) sources.usage = { underUsed };
  }

  // Personalization → explore mode drives whether Explore actions surface.
  if (filters.exploreExploit) {
    sources.personalization = { exploreMode: filters.exploreExploit };
  }

  if (!topRec && !health && !usage) {
    return { data: null, error: toError("Intelligence data unavailable.") };
  }

  const data = buildIntelligenceCenter(sources, {
    generatedAt: new Date().toISOString(),
    topN: filters.topN ?? 7,
  });
  return { data, error: null };
}
