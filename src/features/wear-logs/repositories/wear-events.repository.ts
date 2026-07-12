/**
 * Wear events repository (RFC-023) — only code touching wear_events /
 * wear_event_items. Dual-writes flattened rows to legacy wear_logs for analytics.
 */

import type {
  WearLogSource,
  WearLogWeather,
} from "@/domain/wear-logs";
import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { Database, Json } from "@/types/database";
import type { WearLogRow } from "@/types/wardrobe";

type WearEventUpdate = Database["public"]["Tables"]["wear_events"]["Update"];

export type WearEventRow = {
  id: string;
  worn_on: string;
  occasion_id: string | null;
  outfit_id: string | null;
  source: WearLogSource;
  notes: string | null;
  weather: WearLogWeather | null;
  combination_key: string;
  created_at: string;
};

export type WearEventItemRow = {
  wear_event_id: string;
  item_id: string;
  slot: string | null;
  sort_order: number;
};

export type WearEventInsert = {
  worn_on: string;
  occasion_id?: string | null;
  outfit_id?: string | null;
  source: WearLogSource;
  notes?: string | null;
  weather?: WearLogWeather | null;
  combination_key: string;
};

export type WearEventItemInsert = {
  item_id: string;
  slot?: string | null;
  sort_order?: number;
};

export type WearEventQueryFilters = {
  source?: WearLogSource | "all";
  linkage?: "all" | "linked" | "unlinked";
  occasionId?: string;
  wornFrom?: string;
  wornTo?: string;
  combinationKey?: string;
  itemId?: string;
};

const EVENT_SELECT =
  "id, worn_on, occasion_id, outfit_id, source, notes, weather, combination_key, created_at";

function mapEvent(row: Record<string, unknown>): WearEventRow {
  return {
    id: String(row.id),
    worn_on: String(row.worn_on),
    occasion_id: (row.occasion_id as string | null) ?? null,
    outfit_id: (row.outfit_id as string | null) ?? null,
    source: row.source as WearLogSource,
    notes: (row.notes as string | null) ?? null,
    weather: (row.weather as WearLogWeather | null) ?? null,
    combination_key: String(row.combination_key),
    created_at: String(row.created_at),
  };
}

export async function insertWearEvent(
  event: WearEventInsert,
  items: WearEventItemInsert[],
): Promise<{
  data: { event: WearEventRow; items: WearEventItemRow[] } | null;
  error: Error | null;
}> {
  if (items.length === 0) {
    return { data: null, error: toError("Wear event requires at least one item.") };
  }

  const supabase = createClient();
  const { data: eventRow, error: eventError } = await supabase
    .from("wear_events")
    .insert({
      worn_on: event.worn_on,
      occasion_id: event.occasion_id ?? null,
      outfit_id: event.outfit_id ?? null,
      source: event.source,
      notes: event.notes ?? null,
      weather: (event.weather ?? null) as Json | null,
      combination_key: event.combination_key,
    })
    .select(EVENT_SELECT)
    .single();

  if (eventError || !eventRow) {
    return {
      data: null,
      error: toError(eventError?.message ?? "Failed to create wear event."),
    };
  }

  const eventId = (eventRow as { id: string }).id;
  const itemRows = items.map((item, index) => ({
    wear_event_id: eventId,
    item_id: item.item_id,
    slot: item.slot ?? null,
    sort_order: item.sort_order ?? index,
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from("wear_event_items")
    .insert(itemRows)
    .select("wear_event_id, item_id, slot, sort_order");

  if (itemsError) {
    await supabase.from("wear_events").delete().eq("id", eventId);
    return { data: null, error: toError(itemsError.message) };
  }

  return {
    data: {
      event: mapEvent(eventRow as Record<string, unknown>),
      items: (insertedItems ?? []) as WearEventItemRow[],
    },
    error: null,
  };
}

/** Dual-write flattened item rows into legacy wear_logs for analytics. */
export async function dualWriteLegacyWearLogs(input: {
  itemIds: string[];
  wornOn: string;
  outfitId?: string | null;
  occasionId?: string | null;
  notes?: string | null;
}): Promise<{ data: WearLogRow[] | null; error: Error | null }> {
  if (input.itemIds.length === 0) {
    return { data: [], error: null };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wear_logs")
    .insert(
      input.itemIds.map((itemId) => ({
        item_id: itemId,
        worn_on: input.wornOn,
        outfit_id: input.outfitId ?? null,
        occasion_id: input.occasionId ?? null,
        notes: input.notes ?? null,
      })),
    )
    .select(
      "id, item_id, worn_on, outfit_id, occasion_id, comfort_rating, notes, created_at",
    );

  if (error) {
    return { data: null, error: toError(error.message) };
  }
  return { data: (data ?? []) as WearLogRow[], error: null };
}

export async function selectWearEventById(
  id: string,
): Promise<{
  data: { event: WearEventRow; items: WearEventItemRow[] } | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data: eventRow, error: eventError } = await supabase
    .from("wear_events")
    .select(EVENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (eventError) {
    return { data: null, error: toError(eventError.message) };
  }
  if (!eventRow) {
    return { data: null, error: toError("Wear log not found.") };
  }

  const { data: items, error: itemsError } = await supabase
    .from("wear_event_items")
    .select("wear_event_id, item_id, slot, sort_order")
    .eq("wear_event_id", id)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    return { data: null, error: toError(itemsError.message) };
  }

  return {
    data: {
      event: mapEvent(eventRow as Record<string, unknown>),
      items: (items ?? []) as WearEventItemRow[],
    },
    error: null,
  };
}

export async function selectWearEvents(
  filters: WearEventQueryFilters = {},
): Promise<{
  data: Array<{ event: WearEventRow; items: WearEventItemRow[] }> | null;
  error: Error | null;
}> {
  const supabase = createClient();
  let query = supabase
    .from("wear_events")
    .select(EVENT_SELECT)
    .order("worn_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }
  if (filters.linkage === "linked") {
    query = query.not("outfit_id", "is", null);
  } else if (filters.linkage === "unlinked") {
    query = query.is("outfit_id", null);
  }
  if (filters.occasionId) {
    query = query.eq("occasion_id", filters.occasionId);
  }
  if (filters.wornFrom) {
    query = query.gte("worn_on", filters.wornFrom);
  }
  if (filters.wornTo) {
    query = query.lte("worn_on", filters.wornTo);
  }
  if (filters.combinationKey) {
    query = query.eq("combination_key", filters.combinationKey);
  }

  const { data: events, error } = await query;
  if (error) {
    return { data: null, error: toError(error.message) };
  }

  const eventList = (events ?? []) as Record<string, unknown>[];
  if (eventList.length === 0) {
    return { data: [], error: null };
  }

  const ids = eventList.map((e) => String(e.id));
  const { data: allItems, error: itemsError } = await supabase
    .from("wear_event_items")
    .select("wear_event_id, item_id, slot, sort_order")
    .in("wear_event_id", ids);

  if (itemsError) {
    return { data: null, error: toError(itemsError.message) };
  }

  const byEvent = new Map<string, WearEventItemRow[]>();
  for (const row of (allItems ?? []) as WearEventItemRow[]) {
    const list = byEvent.get(row.wear_event_id) ?? [];
    list.push(row);
    byEvent.set(row.wear_event_id, list);
  }

  let result = eventList.map((row) => {
    const event = mapEvent(row);
    const items = (byEvent.get(event.id) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    return { event, items };
  });

  if (filters.itemId) {
    result = result.filter((r) =>
      r.items.some((i) => i.item_id === filters.itemId),
    );
  }

  return { data: result, error: null };
}

export async function countWearEventsByCombinationKey(
  combinationKey: string,
): Promise<{ data: number | null; error: Error | null }> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("wear_events")
    .select("id", { count: "exact", head: true })
    .eq("combination_key", combinationKey);

  if (error) {
    return { data: null, error: toError(error.message) };
  }
  return { data: count ?? 0, error: null };
}

export async function updateWearEvent(
  id: string,
  patch: {
    worn_on?: string;
    occasion_id?: string | null;
    notes?: string | null;
    weather?: WearLogWeather | null;
    outfit_id?: string | null;
    combination_key?: string;
  },
): Promise<{ data: WearEventRow | null; error: Error | null }> {
  const supabase = createClient();
  const payload: WearEventUpdate = {};
  if (patch.worn_on !== undefined) payload.worn_on = patch.worn_on;
  if (patch.occasion_id !== undefined) payload.occasion_id = patch.occasion_id;
  if (patch.notes !== undefined) payload.notes = patch.notes;
  if (patch.weather !== undefined) payload.weather = patch.weather as Json | null;
  if (patch.outfit_id !== undefined) payload.outfit_id = patch.outfit_id;
  if (patch.combination_key !== undefined) {
    payload.combination_key = patch.combination_key;
  }

  const { data, error } = await supabase
    .from("wear_events")
    .update(payload)
    .eq("id", id)
    .select(EVENT_SELECT)
    .single();

  if (error || !data) {
    return {
      data: null,
      error: toError(error?.message ?? "Failed to update wear event."),
    };
  }
  return { data: mapEvent(data as Record<string, unknown>), error: null };
}

export async function replaceWearEventItems(
  wearEventId: string,
  items: WearEventItemInsert[],
): Promise<{ data: WearEventItemRow[] | null; error: Error | null }> {
  if (items.length === 0) {
    return { data: null, error: toError("Wear event requires at least one item.") };
  }
  const supabase = createClient();
  const { error: delError } = await supabase
    .from("wear_event_items")
    .delete()
    .eq("wear_event_id", wearEventId);
  if (delError) {
    return { data: null, error: toError(delError.message) };
  }

  const { data, error } = await supabase
    .from("wear_event_items")
    .insert(
      items.map((item, index) => ({
        wear_event_id: wearEventId,
        item_id: item.item_id,
        slot: item.slot ?? null,
        sort_order: item.sort_order ?? index,
      })),
    )
    .select("wear_event_id, item_id, slot, sort_order");

  if (error) {
    return { data: null, error: toError(error.message) };
  }
  return { data: (data ?? []) as WearEventItemRow[], error: null };
}

export async function deleteWearEvent(
  id: string,
): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("wear_events").delete().eq("id", id);
  if (error) {
    return { error: toError(error.message) };
  }
  return { error: null };
}

export async function countCombinationFrequencies(): Promise<{
  data: Array<{ combination_key: string; count: number; source_sample: WearLogSource }> | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wear_events")
    .select("combination_key, source")
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  const map = new Map<
    string,
    { combination_key: string; count: number; source_sample: WearLogSource }
  >();
  for (const row of data ?? []) {
    const key = String((row as { combination_key: string }).combination_key);
    const source = (row as { source: WearLogSource }).source;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { combination_key: key, count: 1, source_sample: source });
    }
  }

  return {
    data: [...map.values()].sort((a, b) => b.count - a.count),
    error: null,
  };
}
