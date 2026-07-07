/**
 * Acquisition service (RFC-001). Orchestrates the Buy vs Skip use case:
 * assembles the wardrobe snapshot + analytics via existing repositories/services
 * and runs the pure `evaluateBuyVsSkip` engine. Returns a `{ data, error }`
 * tuple and NEVER calls AI — the decision is 100% deterministic.
 */

import { evaluateBuyVsSkip } from "@/domain/acquisition";
import type { BuyVsSkipAnalysis, ProspectiveItem } from "@/domain/acquisition";
import type { StyleDNAItem } from "@/domain/style-dna";
import {
  fetchUsageAnalytics,
  fetchWardrobeHealth,
} from "@/features/analytics/services/analytics.service";
import {
  selectRecommendationData,
  type RecoItemRow,
} from "@/features/recommendations/repositories/recommendations.repository";
import { getPreferenceProfile } from "@/features/personalization/services/personalization.service";
import { toError } from "@/shared/utils/data-result";

function relatedNames<K extends string>(
  rows: { [key in K]: { name: string } | null }[] | null | undefined,
  key: K,
): string[] {
  return (rows ?? [])
    .map((row) => row[key]?.name ?? null)
    .filter((name): name is string => Boolean(name && name.trim()));
}

/** Map a raw wardrobe row to the StyleDNA-derivable shape the engine needs. */
function toStyleItem(row: RecoItemRow): StyleDNAItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category?.name ?? null,
    subcategory: row.subcategory?.name ?? null,
    color: row.primary_color?.name ?? null,
    formality: row.formality,
    usage: row.usage,
    rating: row.rating,
    seasons: relatedNames(row.item_seasons, "seasons"),
    styles: relatedNames(row.item_styles, "styles"),
    tags: relatedNames(row.item_tags, "tags"),
  };
}

/** Active items only — retired pieces shouldn't shape a buy decision. */
function isActive(row: RecoItemRow): boolean {
  return row.status === "active" || row.status === null;
}

export async function analyzeBuyVsSkip(
  item: ProspectiveItem,
): Promise<{ data: BuyVsSkipAnalysis | null; error: Error | null }> {
  const [dataResult, healthResult, usageResult, preferenceResult] = await Promise.all([
    selectRecommendationData(),
    fetchWardrobeHealth(),
    fetchUsageAnalytics(),
    // Best-effort (RFC-004): learned preferences refine the preferenceFit dimension.
    getPreferenceProfile().catch(() => ({ data: null, error: null })),
  ]);

  if (dataResult.error) return { data: null, error: dataResult.error };
  if (!dataResult.data) {
    return { data: null, error: toError("Wardrobe data unavailable.") };
  }

  const wardrobe = dataResult.data.items.filter(isActive).map(toStyleItem);
  const profile = preferenceResult.data?.profile;
  const preferences = profile
    ? {
        preferredStyles: profile.preferredStyles.map((p) => p.value),
        preferredFormality: profile.preferredFormality.map((p) => p.value),
      }
    : null;

  const analysis = evaluateBuyVsSkip({
    item,
    wardrobe,
    health: healthResult.error ? null : (healthResult.data?.health ?? null),
    usage: usageResult.error ? null : (usageResult.data ?? null),
    preferences,
    inputSource: "manual",
  });

  return { data: analysis, error: null };
}
