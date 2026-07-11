/**
 * item_visual_attributes repository (RFC-020). Persistence only — no merge /
 * vision logic.
 */

import { createClient } from "@/lib/supabase/client";
import type {
  VisualAttributeStatus,
  VisualStyleAttributes,
} from "@/domain/inventory-image-intelligence";
import type { Database, Json } from "@/types/database";
import { toError } from "@/shared/utils/data-result";

const SELECT =
  "id, item_id, image_id, vision_summary, dominant_colors, secondary_colors, pattern, texture, material_guess, silhouette, formality_guess, style_tags, confidence, status, created_at, updated_at, accepted_at, rejected_at";

type ItemVisualAttributesRow = Database["public"]["Tables"]["item_visual_attributes"]["Row"];
type ItemVisualAttributesUpdate =
  Database["public"]["Tables"]["item_visual_attributes"]["Update"];

export type { ItemVisualAttributesRow };

function asColorObservations(
  value: Json | null,
): VisualStyleAttributes["dominantColors"] {
  if (!Array.isArray(value)) return [];
  return value as unknown as VisualStyleAttributes["dominantColors"];
}

export function rowToVisualStyleAttributes(
  row: ItemVisualAttributesRow,
): VisualStyleAttributes {
  return {
    itemId: row.item_id,
    imageId: row.image_id,
    visionSummary: row.vision_summary,
    dominantColors: asColorObservations(row.dominant_colors),
    secondaryColors: asColorObservations(row.secondary_colors),
    pattern: row.pattern,
    texture: row.texture,
    materialGuess: row.material_guess,
    silhouette: row.silhouette,
    formalityGuess: row.formality_guess,
    styleTags: row.style_tags ?? [],
    confidence: Number(row.confidence),
    status: row.status as VisualAttributeStatus,
  };
}

export async function selectVisualAttributesByItemId(
  itemId: string,
): Promise<{ data: ItemVisualAttributesRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("item_visual_attributes")
    .select(SELECT)
    .eq("item_id", itemId)
    .maybeSingle();

  if (error) return { data: null, error: toError(error.message) };
  return { data: (data as ItemVisualAttributesRow | null) ?? null, error: null };
}

export async function selectAcceptedVisualAttributesByItemIds(
  itemIds: string[],
): Promise<{ data: ItemVisualAttributesRow[] | null; error: Error | null }> {
  if (itemIds.length === 0) return { data: [], error: null };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("item_visual_attributes")
    .select(SELECT)
    .in("item_id", itemIds)
    .eq("status", "accepted");

  if (error) return { data: null, error: toError(error.message) };
  return { data: (data as ItemVisualAttributesRow[]) ?? [], error: null };
}

export async function upsertVisualAttributesPending(
  attrs: VisualStyleAttributes,
): Promise<{ data: ItemVisualAttributesRow | null; error: Error | null }> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const payload: Database["public"]["Tables"]["item_visual_attributes"]["Insert"] =
    {
      item_id: attrs.itemId,
      image_id: attrs.imageId,
      vision_summary: (attrs.visionSummary ?? null) as Json | null,
      dominant_colors: attrs.dominantColors as unknown as Json,
      secondary_colors: attrs.secondaryColors as unknown as Json,
      pattern: attrs.pattern,
      texture: attrs.texture,
      material_guess: attrs.materialGuess,
      silhouette: attrs.silhouette,
      formality_guess: attrs.formalityGuess,
      style_tags: attrs.styleTags,
      confidence: attrs.confidence,
      status: "pending",
      updated_at: now,
      accepted_at: null,
      rejected_at: null,
    };

  const { data, error } = await supabase
    .from("item_visual_attributes")
    .upsert(payload, { onConflict: "item_id" })
    .select(SELECT)
    .single();

  if (error) return { data: null, error: toError(error.message) };
  return { data: data as ItemVisualAttributesRow, error: null };
}

export async function updateVisualAttributesStatus(
  itemId: string,
  status: Extract<VisualAttributeStatus, "accepted" | "rejected" | "stale">,
): Promise<{ data: ItemVisualAttributesRow | null; error: Error | null }> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const patch: ItemVisualAttributesUpdate = {
    status,
    updated_at: now,
  };
  if (status === "accepted") {
    patch.accepted_at = now;
    patch.rejected_at = null;
  } else if (status === "rejected") {
    patch.rejected_at = now;
    patch.accepted_at = null;
  }

  const { data, error } = await supabase
    .from("item_visual_attributes")
    .update(patch)
    .eq("item_id", itemId)
    .select(SELECT)
    .maybeSingle();

  if (error) return { data: null, error: toError(error.message) };
  return { data: (data as ItemVisualAttributesRow | null) ?? null, error: null };
}

/** Items that have a primary image and no accepted visual attrs (or stale/none). */
export async function selectBackfillCandidates(limit = 50): Promise<{
  data: { item_id: string; name: string; image_id: string }[] | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const { data: images, error: imageError } = await supabase
    .from("item_images")
    .select("id, item_id")
    .eq("is_primary", true)
    .limit(limit * 2);

  if (imageError) return { data: null, error: toError(imageError.message) };

  const primaryByItem = new Map<string, string>();
  for (const row of images ?? []) {
    if (row.item_id && row.id && !primaryByItem.has(row.item_id)) {
      primaryByItem.set(row.item_id, row.id);
    }
  }

  const itemIds = [...primaryByItem.keys()];
  if (itemIds.length === 0) return { data: [], error: null };

  const { data: visuals, error: visualError } = await supabase
    .from("item_visual_attributes")
    .select("item_id, status")
    .in("item_id", itemIds);

  if (visualError) return { data: null, error: toError(visualError.message) };

  const statusByItem = new Map(
    (visuals ?? []).map((v) => [v.item_id as string, v.status as string]),
  );

  const need = itemIds.filter((id) => {
    const status = statusByItem.get(id);
    return !status || status === "stale" || status === "rejected";
  });

  const { data: items, error: itemsError } = await supabase
    .from("wardrobe_items")
    .select("id, name")
    .in("id", need.slice(0, limit));

  if (itemsError) return { data: null, error: toError(itemsError.message) };

  const rows = (items ?? []).map((item) => ({
    item_id: item.id as string,
    name: item.name as string,
    image_id: primaryByItem.get(item.id as string)!,
  }));

  return { data: rows, error: null };
}
