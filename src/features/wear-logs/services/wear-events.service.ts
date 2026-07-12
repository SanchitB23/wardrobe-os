/**
 * Wear event orchestration (RFC-023).
 * Creates event-centric wear logs, dual-writes legacy wear_logs for analytics,
 * detects repeated combinations, and promotes to saved outfits (user-confirmed).
 */

import {
  buildCombinationKey,
  buildCombinationSuggestion,
  buildOrderedWearItems,
  mapWearLogToOutfitDraft,
  type CombinationSuggestion,
  type WearLogEventModel,
  type WearLogSource,
  type WearLogWeather,
} from "@/domain/wear-logs";
import {
  categoryMatchesOutfitSlot,
  OUTFIT_SLOT_DEFINITIONS,
} from "@/domain/outfit/slot-matching";
import * as wearEventsRepository from "@/features/wear-logs/repositories/wear-events.repository";
import * as wearLogsRepository from "@/features/wear-logs/repositories/wear-logs.repository";
import {
  createOutfit,
  setOutfitFavorite,
} from "@/features/outfits/services/outfits.service";
import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { OutfitSlot, SaveOutfitInput } from "@/types/wardrobe";

type Result<T> = { data: T | null; error: Error | null };

export type CreateWearLogEventInput = {
  wornOn: string;
  items: Array<{ itemId: string; slot?: string | null }>;
  occasionId?: string | null;
  notes?: string | null;
  weather?: WearLogWeather | null;
  source: WearLogSource;
  outfitId?: string | null;
  /** Skip dual-write to legacy wear_logs (tests / special cases). */
  skipLegacyDualWrite?: boolean;
};

export type WearLogEventDetail = WearLogEventModel & {
  itemDetails: Array<{
    itemId: string;
    code: string;
    name: string;
    categoryName: string | null;
    slot: string | null;
    sortOrder: number;
  }>;
  occasionName: string | null;
  outfitName: string | null;
};

export type WearEventListFilters = {
  source?: WearLogSource | "all";
  linkage?: "all" | "linked" | "unlinked";
  occasionId?: string;
  wornFrom?: string;
  wornTo?: string;
  itemId?: string;
};

function toModel(
  event: wearEventsRepository.WearEventRow,
  items: wearEventsRepository.WearEventItemRow[],
): WearLogEventModel {
  return {
    id: event.id,
    wornOn: event.worn_on,
    occasionId: event.occasion_id,
    outfitId: event.outfit_id,
    source: event.source,
    notes: event.notes,
    weather: event.weather,
    combinationKey: event.combination_key,
    items: items
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        itemId: i.item_id,
        slot: i.slot,
        sortOrder: i.sort_order,
      })),
    createdAt: event.created_at,
  };
}

function inferSlot(
  categoryName: string | null | undefined,
  explicit?: string | null,
): string | null {
  if (explicit) return explicit;
  if (!categoryName) return null;
  for (const def of OUTFIT_SLOT_DEFINITIONS) {
    if (categoryMatchesOutfitSlot(categoryName, def.slot)) {
      return def.slot;
    }
  }
  return "accessory";
}

function slotForOutfit(slot: string | null): OutfitSlot {
  const allowed = OUTFIT_SLOT_DEFINITIONS.map((d) => d.slot);
  if (slot && (allowed as string[]).includes(slot)) {
    return slot as OutfitSlot;
  }
  return "accessory";
}

/**
 * Create an event-centric wear log. Dual-writes per-item rows to legacy
 * wear_logs so Usage / ROI / Recommendation / Personalization keep working.
 */
export async function createWearLogEvent(
  input: CreateWearLogEventInput,
): Promise<
  Result<{ wearLog: WearLogEventModel; suggestion: CombinationSuggestion }>
> {
  try {
    if (input.source === "outfit" && !input.outfitId) {
      return {
        data: null,
        error: toError("Outfit wear logs require an outfit_id."),
      };
    }

    const ordered = buildOrderedWearItems(input.items);
    const combinationKey = buildCombinationKey(ordered.map((i) => i.itemId));

    const inserted = await wearEventsRepository.insertWearEvent(
      {
        worn_on: input.wornOn,
        occasion_id: input.occasionId ?? null,
        outfit_id: input.outfitId ?? null,
        source: input.source,
        notes: input.notes?.trim() || null,
        weather: input.weather ?? null,
        combination_key: combinationKey,
      },
      ordered.map((i) => ({
        item_id: i.itemId,
        slot: i.slot,
        sort_order: i.sortOrder,
      })),
    );

    if (inserted.error || !inserted.data) {
      return { data: null, error: inserted.error };
    }

    if (!input.skipLegacyDualWrite) {
      const legacy = await wearEventsRepository.dualWriteLegacyWearLogs({
        itemIds: ordered.map((i) => i.itemId),
        wornOn: input.wornOn,
        outfitId: input.outfitId ?? null,
        occasionId: input.occasionId ?? null,
        notes: input.notes?.trim() || null,
      });
      if (legacy.error) {
        // Event already persisted — surface error but keep event (analytics may lag).
        return {
          data: null,
          error: toError(
            `Wear log saved, but analytics dual-write failed: ${legacy.error.message}`,
          ),
        };
      }
    }

    const countResult =
      await wearEventsRepository.countWearEventsByCombinationKey(combinationKey);
    const count = countResult.data ?? 1;
    const suggestion = buildCombinationSuggestion({
      combinationKey,
      count,
      itemCount: ordered.length,
      sourceIsOutfit: input.source === "outfit",
    });

    return {
      data: {
        wearLog: toModel(inserted.data.event, inserted.data.items),
        suggestion,
      },
      error: null,
    };
  } catch (caught) {
    return {
      data: null,
      error: caught instanceof Error ? caught : toError("Failed to create wear log."),
    };
  }
}

export async function createAdHocWearLog(
  input: Omit<CreateWearLogEventInput, "source" | "outfitId">,
): Promise<
  Result<{ wearLog: WearLogEventModel; suggestion: CombinationSuggestion }>
> {
  return createWearLogEvent({ ...input, source: "ad_hoc", outfitId: null });
}

export async function createWearLogFromOutfit(input: {
  outfitId: string;
  items: Array<{ itemId: string; slot?: string | null }>;
  wornOn: string;
  occasionId?: string | null;
  notes?: string | null;
  weather?: WearLogWeather | null;
}): Promise<
  Result<{ wearLog: WearLogEventModel; suggestion: CombinationSuggestion }>
> {
  return createWearLogEvent({
    ...input,
    source: "outfit",
    outfitId: input.outfitId,
  });
}

export async function createWearLogFromRecommendation(input: {
  items: Array<{ itemId: string; slot?: string | null }>;
  wornOn: string;
  occasionId?: string | null;
  notes?: string | null;
  weather?: WearLogWeather | null;
  /** If recommendation was already a saved outfit, link it. */
  outfitId?: string | null;
}): Promise<
  Result<{ wearLog: WearLogEventModel; suggestion: CombinationSuggestion }>
> {
  return createWearLogEvent({
    ...input,
    source: "recommendation",
    outfitId: input.outfitId ?? null,
  });
}

export async function listWearLogEvents(
  filters: WearEventListFilters = {},
): Promise<Result<WearLogEventModel[]>> {
  const result = await wearEventsRepository.selectWearEvents(filters);
  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }
  return {
    data: result.data.map(({ event, items }) => toModel(event, items)),
    error: null,
  };
}

export async function getWearLogEvent(
  id: string,
): Promise<Result<WearLogEventDetail>> {
  const result = await wearEventsRepository.selectWearEventById(id);
  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  const model = toModel(result.data.event, result.data.items);
  const itemIds = model.items.map((i) => i.itemId);
  const [itemsResult, occasionsResult, categoriesResult] = await Promise.all([
    wearLogsRepository.fetchWardrobeItemsByIds(itemIds),
    model.occasionId
      ? wearLogsRepository.fetchOccasionsByIds([model.occasionId])
      : Promise.resolve({ data: [], error: null }),
    wearLogsRepository.fetchAllCategories(),
  ]);

  if (itemsResult.error || occasionsResult.error || categoriesResult.error) {
    return {
      data: null,
      error:
        itemsResult.error ??
        occasionsResult.error ??
        categoriesResult.error,
    };
  }

  const categoryMap = new Map(
    (categoriesResult.data ?? []).map((c) => [c.id, c.name]),
  );
  const itemMap = new Map((itemsResult.data ?? []).map((i) => [i.id, i]));

  let outfitName: string | null = null;
  if (model.outfitId) {
    const supabase = createClient();
    const { data } = await supabase
      .from("outfits")
      .select("name")
      .eq("id", model.outfitId)
      .maybeSingle();
    outfitName = (data as { name?: string } | null)?.name ?? null;
  }

  return {
    data: {
      ...model,
      itemDetails: model.items.map((i) => {
        const row = itemMap.get(i.itemId);
        const categoryName = row?.category_id
          ? (categoryMap.get(row.category_id) ?? null)
          : null;
        return {
          itemId: i.itemId,
          code: row?.code ?? "",
          name: row?.name ?? "Unknown item",
          categoryName,
          slot: i.slot ?? inferSlot(categoryName),
          sortOrder: i.sortOrder,
        };
      }),
      occasionName: occasionsResult.data?.[0]?.name ?? null,
      outfitName,
    },
    error: null,
  };
}

export async function updateWearLogEvent(input: {
  id: string;
  wornOn?: string;
  occasionId?: string | null;
  notes?: string | null;
  weather?: WearLogWeather | null;
  items?: Array<{ itemId: string; slot?: string | null }>;
}): Promise<Result<WearLogEventModel>> {
  const existing = await wearEventsRepository.selectWearEventById(input.id);
  if (existing.error || !existing.data) {
    return { data: null, error: existing.error };
  }

  let combinationKey = existing.data.event.combination_key;
  let items = existing.data.items;

  if (input.items) {
    const ordered = buildOrderedWearItems(input.items);
    combinationKey = buildCombinationKey(ordered.map((i) => i.itemId));
    const replaced = await wearEventsRepository.replaceWearEventItems(
      input.id,
      ordered.map((i) => ({
        item_id: i.itemId,
        slot: i.slot,
        sort_order: i.sortOrder,
      })),
    );
    if (replaced.error || !replaced.data) {
      return { data: null, error: replaced.error };
    }
    items = replaced.data;
  }

  const updated = await wearEventsRepository.updateWearEvent(input.id, {
    worn_on: input.wornOn,
    occasion_id: input.occasionId,
    notes: input.notes !== undefined ? input.notes?.trim() || null : undefined,
    weather: input.weather,
    combination_key: input.items ? combinationKey : undefined,
  });

  if (updated.error || !updated.data) {
    return { data: null, error: updated.error };
  }

  return { data: toModel(updated.data, items), error: null };
}

export async function deleteWearLogEvent(
  id: string,
): Promise<Result<null>> {
  const result = await wearEventsRepository.deleteWearEvent(id);
  if (result.error) {
    return { data: null, error: result.error };
  }
  return { data: null, error: null };
}

export async function promoteWearLogToOutfit(input: {
  wearLogId: string;
  name: string;
  favorite?: boolean;
  /** Freeform tags stored in outfit notes (outfits have no tags table). */
  tags?: string[];
  notes?: string | null;
  linkThisLog?: boolean;
}): Promise<Result<{ outfitId: string; wearLog: WearLogEventModel }>> {
  const name = input.name.trim();
  if (!name) {
    return { data: null, error: toError("Outfit name is required.") };
  }

  const existing = await wearEventsRepository.selectWearEventById(input.wearLogId);
  if (existing.error || !existing.data) {
    return { data: null, error: existing.error };
  }

  const model = toModel(existing.data.event, existing.data.items);
  if (model.source === "outfit" && model.outfitId) {
    return {
      data: null,
      error: toError("This wear log is already linked to a saved outfit."),
    };
  }

  const draft = mapWearLogToOutfitDraft(model);
  const tagLine =
    input.tags && input.tags.length > 0
      ? `Tags: ${input.tags.map((t) => t.trim()).filter(Boolean).join(", ")}`
      : null;
  const notesParts = [input.notes?.trim() || draft.notes, tagLine].filter(
    Boolean,
  );

  const saveInput: SaveOutfitInput = {
    name,
    occasion_id: draft.occasionId,
    notes: notesParts.length > 0 ? notesParts.join("\n") : null,
    items: draft.slots.map((s) => ({
      item_id: s.itemId,
      slot: slotForOutfit(s.slot),
    })),
  };

  const created = await createOutfit(saveInput);
  if (created.error || !created.data) {
    return { data: null, error: created.error };
  }

  if (input.favorite) {
    await setOutfitFavorite(created.data.id, true);
  }

  let wearLog = model;
  if (input.linkThisLog !== false) {
    const linked = await wearEventsRepository.updateWearEvent(input.wearLogId, {
      outfit_id: created.data.id,
    });
    if (linked.error || !linked.data) {
      return { data: null, error: linked.error };
    }
    wearLog = toModel(linked.data, existing.data.items);
  }

  return {
    data: { outfitId: created.data.id, wearLog },
    error: null,
  };
}

export async function getPromotionCandidates(
  threshold = 3,
): Promise<
  Result<
    Array<{
      combinationKey: string;
      count: number;
      sourceSample: WearLogSource;
      shouldSuggestPromote: boolean;
    }>
  >
> {
  const freqs = await wearEventsRepository.countCombinationFrequencies();
  if (freqs.error || !freqs.data) {
    return { data: null, error: freqs.error };
  }

  return {
    data: freqs.data
      .filter((row) => row.count >= threshold && row.source_sample !== "outfit")
      .map((row) => ({
        combinationKey: row.combination_key,
        count: row.count,
        sourceSample: row.source_sample,
        shouldSuggestPromote: true,
      })),
    error: null,
  };
}

export async function getDeveloperWearInsights(): Promise<
  Result<{
    bySource: Record<WearLogSource, number>;
    combinationFrequencies: Array<{
      combinationKey: string;
      count: number;
      sourceSample: WearLogSource;
    }>;
    promotionCandidates: Array<{
      combinationKey: string;
      count: number;
      sourceSample: WearLogSource;
    }>;
  }>
> {
  const [events, freqs, candidates] = await Promise.all([
    wearEventsRepository.selectWearEvents({}),
    wearEventsRepository.countCombinationFrequencies(),
    getPromotionCandidates(),
  ]);

  if (events.error || freqs.error || candidates.error) {
    return {
      data: null,
      error: events.error ?? freqs.error ?? candidates.error,
    };
  }

  const bySource: Record<WearLogSource, number> = {
    outfit: 0,
    ad_hoc: 0,
    recommendation: 0,
    trip: 0,
    ai: 0,
  };
  for (const { event } of events.data ?? []) {
    bySource[event.source] += 1;
  }

  return {
    data: {
      bySource,
      combinationFrequencies: (freqs.data ?? []).map((r) => ({
        combinationKey: r.combination_key,
        count: r.count,
        sourceSample: r.source_sample,
      })),
      promotionCandidates: (candidates.data ?? []).map((c) => ({
        combinationKey: c.combinationKey,
        count: c.count,
        sourceSample: c.sourceSample,
      })),
    },
    error: null,
  };
}

/** Enrich ad-hoc item picks with inferred slots from category names. */
export async function enrichItemsWithSlots(
  itemIds: string[],
): Promise<Array<{ itemId: string; slot: string | null }>> {
  const items = await wearLogsRepository.fetchWardrobeItemsByIds(itemIds);
  const categories = await wearLogsRepository.fetchAllCategories();
  const categoryMap = new Map(
    (categories.data ?? []).map((c) => [c.id, c.name]),
  );
  const itemMap = new Map((items.data ?? []).map((i) => [i.id, i]));

  return itemIds.map((id) => {
    const row = itemMap.get(id);
    const categoryName = row?.category_id
      ? (categoryMap.get(row.category_id) ?? null)
      : null;
    return { itemId: id, slot: inferSlot(categoryName) };
  });
}
