/**
 * Personalization repository (RFC-004) — the only code that touches Supabase for
 * preference learning. Reads behavioural signal sources (items, wears, saved
 * outfits, purchases) + user overrides + protected/avoided item flags, and
 * persists overrides + item flags. No domain logic here.
 */

import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type {
  ItemFacetSource,
  PersonalizationSourceData,
  PurchaseSource,
  SavedOutfitSource,
  WearEventSource,
} from "@/domain/personalization";
import type { OverrideMode, PreferenceDimension, PreferenceOverride } from "@/domain/personalization";
import type { FormalityEnum } from "@/types/wardrobe";

type NamedRef = { name: string } | null;

const ITEM_SELECT = `
  id,
  name,
  formality,
  fit,
  favorite,
  protected,
  avoided,
  updated_at,
  brand:brands(name),
  category:categories(name),
  subcategory:subcategories(name),
  primary_color:colors!wardrobe_items_primary_color_id_fkey(name, family),
  item_seasons(seasons(name)),
  item_styles(styles(name))
`;

type ItemRow = {
  id: string;
  name: string;
  formality: FormalityEnum | null;
  fit: string | null;
  favorite: boolean | null;
  protected: boolean | null;
  avoided: boolean | null;
  updated_at: string | null;
  brand: NamedRef;
  category: NamedRef;
  subcategory: NamedRef;
  primary_color: ({ name: string; family: string | null } | null);
  item_seasons: { seasons: NamedRef }[] | null;
  item_styles: { styles: NamedRef }[] | null;
};

type WearRow = { item_id: string | null; worn_on: string; occasion: NamedRef };
type OutfitRow = { id: string; favorite: boolean | null; created_at: string | null };
type OutfitItemRow = { outfit_id: string; item_id: string };
type PurchaseRow = { item_id: string | null; purchase_date: string | null };
type OverrideRow = { dimension: string; value: string; mode: string; weight: number | null };

export interface PersonalizationRepositoryData {
  source: PersonalizationSourceData;
  overrides: PreferenceOverride[];
  protectedItemIds: string[];
  avoidedItemIds: string[];
  /** id → display name, for rendering protected/avoided lists. */
  itemNames: Record<string, string>;
}

function names(rows: { [k: string]: NamedRef }[] | null, key: string): string[] {
  return (rows ?? [])
    .map((r) => (r[key] as NamedRef)?.name)
    .filter((n): n is string => Boolean(n));
}

function toItemFacetSource(row: ItemRow): ItemFacetSource {
  return {
    id: row.id,
    color: row.primary_color?.name ?? null,
    colorFamily: row.primary_color?.family ?? null,
    brand: row.brand?.name ?? null,
    formality: row.formality ?? null,
    fit: row.fit ?? null,
    category: row.category?.name ?? null,
    subcategory: row.subcategory?.name ?? null,
    styles: names(row.item_styles, "styles"),
    seasons: names(row.item_seasons, "seasons"),
    favorite: Boolean(row.favorite),
    updatedAt: row.updated_at ?? null,
  };
}

/** Read everything the Personalization Engine needs, in parallel. */
export async function selectPersonalizationData(): Promise<{
  data: PersonalizationRepositoryData | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const [items, wears, outfits, outfitItems, purchases, overrides] = await Promise.all([
    supabase.from("wardrobe_items").select(ITEM_SELECT).order("name"),
    supabase.from("wear_logs").select("item_id, worn_on, occasion:occasions(name)"),
    supabase.from("outfits").select("id, favorite, created_at"),
    supabase.from("outfit_items").select("outfit_id, item_id"),
    supabase.from("purchases").select("item_id, purchase_date"),
    supabase.from("preference_overrides").select("dimension, value, mode, weight"),
  ]);

  const error =
    items.error ?? wears.error ?? outfits.error ?? outfitItems.error ?? purchases.error ?? overrides.error;
  if (error) return { data: null, error: toError(error.message) };

  const itemRows = (items.data ?? []) as unknown as ItemRow[];
  const wearRows = (wears.data ?? []) as unknown as WearRow[];
  const outfitRows = (outfits.data ?? []) as unknown as OutfitRow[];
  const outfitItemRows = (outfitItems.data ?? []) as unknown as OutfitItemRow[];
  const purchaseRows = (purchases.data ?? []) as unknown as PurchaseRow[];
  const overrideRows = (overrides.data ?? []) as unknown as OverrideRow[];

  const itemsById = new Map(itemRows.map((r) => [r.id, r]));

  const wearEvents: WearEventSource[] = wearRows
    .filter((w) => w.item_id && itemsById.has(w.item_id))
    .map((w) => ({ itemId: w.item_id as string, wornOn: w.worn_on, occasion: w.occasion?.name ?? null }));

  const itemsByOutfit = new Map<string, string[]>();
  for (const link of outfitItemRows) {
    const list = itemsByOutfit.get(link.outfit_id) ?? [];
    list.push(link.item_id);
    itemsByOutfit.set(link.outfit_id, list);
  }
  const savedOutfits: SavedOutfitSource[] = outfitRows
    .filter((o) => o.favorite)
    .map((o) => ({
      itemIds: itemsByOutfit.get(o.id) ?? [],
      favorite: true,
      createdAt: o.created_at ?? null,
    }));

  const purchaseSources: PurchaseSource[] = purchaseRows
    .filter((p) => p.item_id && itemsById.has(p.item_id))
    .map((p) => ({ itemId: p.item_id as string, purchaseDate: p.purchase_date ?? null }));

  return {
    data: {
      source: {
        items: itemRows.map(toItemFacetSource),
        wearEvents,
        savedOutfits,
        purchases: purchaseSources,
      },
      overrides: overrideRows.map((o) => ({
        dimension: o.dimension as PreferenceDimension,
        value: o.value,
        mode: o.mode as OverrideMode,
        weight: o.weight,
      })),
      protectedItemIds: itemRows.filter((r) => r.protected).map((r) => r.id),
      avoidedItemIds: itemRows.filter((r) => r.avoided).map((r) => r.id),
      itemNames: Object.fromEntries(itemRows.map((r) => [r.id, r.name])),
    },
    error: null,
  };
}

/** Insert or update a preference override (unique on dimension + value). */
export async function upsertPreferenceOverride(
  override: PreferenceOverride,
): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("preference_overrides").upsert(
    {
      dimension: override.dimension,
      value: override.value,
      mode: override.mode,
      weight: override.weight ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "dimension,value" },
  );
  return { error: error ? toError(error.message) : null };
}

/** Remove a preference override. */
export async function deletePreferenceOverride(
  dimension: PreferenceDimension,
  value: string,
): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("preference_overrides")
    .delete()
    .eq("dimension", dimension)
    .eq("value", value);
  return { error: error ? toError(error.message) : null };
}

/** Set the protected / avoided flags on an item. */
export async function setItemPersonalizationFlags(
  itemId: string,
  flags: { protected?: boolean; avoided?: boolean },
): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const patch: { protected?: boolean; avoided?: boolean } = {};
  if (typeof flags.protected === "boolean") patch.protected = flags.protected;
  if (typeof flags.avoided === "boolean") patch.avoided = flags.avoided;
  const { error } = await supabase.from("wardrobe_items").update(patch).eq("id", itemId);
  return { error: error ? toError(error.message) : null };
}
