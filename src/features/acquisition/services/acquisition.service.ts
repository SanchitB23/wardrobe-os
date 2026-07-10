/**
 * Acquisition service (RFC-001). Orchestrates the Buy vs Skip use case:
 * assembles the wardrobe snapshot + analytics via existing repositories/services
 * and runs the pure `evaluateBuyVsSkip` engine. Returns a `{ data, error }`
 * tuple and NEVER calls AI — the decision is 100% deterministic.
 */

import { evaluateBuyVsSkip } from "@/domain/acquisition";
import type {
  BuyVsSkipAnalysis,
  BuyVsSkipInputSource,
  PreferenceHints,
  ProspectiveItem,
} from "@/domain/acquisition";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import type { UsageAnalytics } from "@/domain/analytics/UsageAnalyticsEngine";
import type { StyleDNAItem } from "@/domain/style-dna";
import {
  fetchUsageAnalytics,
  fetchWardrobeHealth,
} from "@/features/analytics/services/analytics.service";
import {
  selectRecommendationData,
  type RecommendationData,
  type RecoItemRow,
} from "@/features/recommendations/repositories/recommendations.repository";
import { getPreferenceProfile } from "@/features/personalization/services/personalization.service";
import { toError } from "@/shared/utils/data-result";

/**
 * The shared, deterministic input snapshot the Buy vs Skip engine needs. Loaded
 * once and reusable across many prospective items (e.g. Shopping Intelligence
 * ranking a wishlist — RFC-018) so the wardrobe/analytics aren't re-fetched per
 * item. `raw` is the underlying recommendation data (items, wears, purchases),
 * exposed so downstream features can derive ROI / duplicates without re-querying.
 */
export interface AcquisitionContext {
  wardrobe: StyleDNAItem[];
  health: WardrobeHealth | null;
  usage: UsageAnalytics | null;
  preferences: PreferenceHints | null;
  raw: RecommendationData;
}

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

/**
 * Load the shared Buy vs Skip snapshot once. Callers that evaluate many items
 * (Shopping Intelligence, RFC-018) load this a single time and reuse it, instead
 * of re-fetching the wardrobe per item.
 */
export async function loadAcquisitionContext(): Promise<{
  data: AcquisitionContext | null;
  error: Error | null;
}> {
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

  const profile = preferenceResult.data?.profile;
  return {
    data: {
      wardrobe: dataResult.data.items.filter(isActive).map(toStyleItem),
      health: healthResult.error ? null : (healthResult.data?.health ?? null),
      usage: usageResult.error ? null : (usageResult.data ?? null),
      preferences: profile
        ? {
            preferredStyles: profile.preferredStyles.map((p) => p.value),
            preferredFormality: profile.preferredFormality.map((p) => p.value),
          }
        : null,
      raw: dataResult.data,
    },
    error: null,
  };
}

/** Run the pure engine against a preloaded context — no I/O, deterministic. */
export function evaluateWithContext(
  item: ProspectiveItem,
  context: AcquisitionContext,
  inputSource: BuyVsSkipInputSource = "manual",
): BuyVsSkipAnalysis {
  return evaluateBuyVsSkip({
    item,
    wardrobe: context.wardrobe,
    health: context.health,
    usage: context.usage,
    preferences: context.preferences,
    inputSource,
  });
}

export async function analyzeBuyVsSkip(
  item: ProspectiveItem,
): Promise<{ data: BuyVsSkipAnalysis | null; error: Error | null }> {
  const { data: context, error } = await loadAcquisitionContext();
  if (error || !context) return { data: null, error: error ?? toError("Wardrobe data unavailable.") };
  return { data: evaluateWithContext(item, context), error: null };
}
