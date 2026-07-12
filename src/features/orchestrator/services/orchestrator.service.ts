/**
 * Orchestrator service (RFC-005) — assembles the shared ExecutionContext from
 * repositories/services and runs the pure IntelligenceOrchestrator, returning
 * `{ data, error }`. This is the only place that does I/O for orchestration;
 * the orchestrator itself is pure and never touches Supabase or AI.
 */

import {
  createExecutionContext,
  orchestrate,
  type CapabilityRequest,
  type ExecutionReport,
} from "@/domain/orchestrator";
import { buildRecommendationContext } from "@/domain/recommendation";
import type { WardrobeItemInput } from "@/domain/recommendation";
import { toPreferenceSnapshot } from "@/domain/personalization";
import type { StyleDNAItem } from "@/domain/style-dna";
import {
  fetchUsageAnalytics,
  fetchWardrobeHealth,
} from "@/features/analytics/services/analytics.service";
import { fetchPurchaseAnalytics } from "@/features/purchases/services/purchases.service";
import { getPreferenceProfile } from "@/features/personalization/services/personalization.service";
import {
  selectRecommendationData,
  type RecoItemRow,
} from "@/features/recommendations/repositories/recommendations.repository";
import { toError } from "@/shared/utils/data-result";
import { logOrchestratorRun } from "@/runtime/logging/orchestrator-logger";

function relatedNames<K extends string>(
  rows: { [key in K]: { name: string } | null }[] | null | undefined,
  key: K,
): string[] {
  return (rows ?? [])
    .map((row) => row[key]?.name ?? null)
    .filter((name): name is string => Boolean(name && name.trim()));
}

function toItemInput(row: RecoItemRow): WardrobeItemInput {
  return {
    id: row.id,
    name: row.name,
    category: row.category?.name ?? null,
    subcategory: row.subcategory?.name ?? null,
    color: row.primary_color?.name ?? null,
    formality: row.formality,
    usage: row.usage,
    rating: row.rating,
    status: row.status,
    seasons: relatedNames(row.item_seasons, "seasons"),
    styles: relatedNames(row.item_styles, "styles"),
    tags: relatedNames(row.item_tags, "tags"),
  };
}

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

const isActive = (row: RecoItemRow) => row.status === "active" || row.status === null;

/**
 * Run an orchestration request end-to-end: assemble context from data, run the
 * deterministic orchestrator, return the report. AI (if any) consumes the
 * returned report — it is never part of planning or execution.
 */
export async function runOrchestration(
  request: CapabilityRequest,
): Promise<{ data: ExecutionReport | null; error: Error | null }> {
  // One instant for the whole request — every engine call shares it (RFC-008/H3).
  const generatedAt = new Date().toISOString();
  const [dataResult, healthResult, usageResult, purchaseResult, preferenceResult] =
    await Promise.all([
      selectRecommendationData(),
      fetchWardrobeHealth(),
      fetchUsageAnalytics(),
      fetchPurchaseAnalytics(),
      getPreferenceProfile({ generatedAt }).catch(() => ({ data: null, error: null })),
    ]);

  if (dataResult.error) return { data: null, error: dataResult.error };
  if (healthResult.error) return { data: null, error: healthResult.error };
  if (!dataResult.data || !healthResult.data) {
    return { data: null, error: toError("Wardrobe data unavailable.") };
  }

  const raw = dataResult.data;
  const health = healthResult.data.health;
  const usage = usageResult.error ? null : (usageResult.data ?? null);
  const purchase = purchaseResult.error ? null : (purchaseResult.data ?? null);
  const learnedPreferences = preferenceResult.data
    ? toPreferenceSnapshot(preferenceResult.data.profile)
    : undefined;

  const itemsByOutfit = new Map<string, string[]>();
  for (const link of raw.outfitItems) {
    const list = itemsByOutfit.get(link.outfit_id) ?? [];
    list.push(link.item_id);
    itemsByOutfit.set(link.outfit_id, list);
  }

  const recommendation = buildRecommendationContext(
    {
      health,
      usageAnalytics: usage,
      purchaseAnalytics: purchase,
      wardrobeItems: raw.items.map(toItemInput),
      wearLogs: raw.wearLogs
        .filter((r): r is typeof r & { item_id: string } => Boolean(r.item_id))
        .map((r) => ({ itemId: r.item_id, wornOn: r.worn_on })),
      purchases: raw.purchases.map((p) => ({ itemId: p.item_id, price: p.price })),
      savedOutfits: raw.outfits.map((o) => ({
        id: o.id,
        name: o.name,
        itemIds: itemsByOutfit.get(o.id) ?? [],
        favorite: Boolean(o.favorite),
        score: o.rating,
        lastWornOn: null,
      })),
      preferences: learnedPreferences,
      protectedItemIds: preferenceResult.data?.profile.protectedItemIds ?? [],
      avoidedItemIds: preferenceResult.data?.profile.avoidedItemIds ?? [],
    },
    { generatedAt },
  );

  const context = createExecutionContext({
    recommendation,
    wardrobe: raw.items.filter(isActive).map(toStyleItem),
    health,
    usage,
    purchase,
    inputs: request.inputs ?? {},
  });

  const report = orchestrate(request, context);
  // Observability at the service boundary — domain stays pure (RFC-022).
  logOrchestratorRun({
    report,
    capability: request.capabilities?.[0] ?? "orchestrate",
  });
  return { data: report, error: null };
}
