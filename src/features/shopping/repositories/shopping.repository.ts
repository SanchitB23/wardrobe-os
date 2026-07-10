/**
 * Shopping repository (RFC-018) — the only code touching `wishlist_items`. Reads/
 * writes via the Supabase anon client (anon RLS); maps rows ⇄ the persisted
 * `WishlistItem` shape. No domain logic. Purchases/wear-logs/wardrobe for ROI +
 * duplicates are read through the shared acquisition context, not here.
 */

import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { BuyVsSkipInputSource } from "@/domain/acquisition";
import type { WishlistStatus } from "@/domain/shopping";
import type { SaveWishlistInput, WishlistItem } from "@/features/shopping/types";

type Result<T> = { data: T | null; error: Error | null };

type WishlistRow = {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  color: string | null;
  formality: string | null;
  material: string | null;
  price: number | null;
  style_tags: string[] | null;
  occasions: string[] | null;
  image_url: string | null;
  source: string;
  source_url: string | null;
  notes: string | null;
  status: string;
  purchased_id: string | null;
  created_at: string;
  updated_at: string;
};

function toItem(row: WishlistRow): WishlistItem {
  return {
    id: row.id,
    item: {
      name: row.name,
      category: row.category ?? "",
      subcategory: row.subcategory,
      brand: row.brand,
      color: row.color,
      formality: row.formality,
      material: row.material,
      estimatedPrice: row.price,
      styleTags: row.style_tags ?? undefined,
      intendedOccasions: row.occasions ?? undefined,
      productUrl: row.source_url,
      notes: row.notes,
    },
    source: row.source as BuyVsSkipInputSource,
    sourceUrl: row.source_url,
    imageUrl: row.image_url,
    notes: row.notes,
    status: row.status as WishlistStatus,
    purchasedId: row.purchased_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: SaveWishlistInput) {
  const { item } = input;
  return {
    name: item.name,
    category: item.category || null,
    subcategory: item.subcategory ?? null,
    brand: item.brand ?? null,
    color: item.color ?? null,
    formality: item.formality ?? null,
    material: item.material ?? null,
    price: item.estimatedPrice ?? null,
    style_tags: item.styleTags && item.styleTags.length > 0 ? item.styleTags : null,
    occasions:
      item.intendedOccasions && item.intendedOccasions.length > 0 ? item.intendedOccasions : null,
    image_url: input.imageUrl ?? null,
    source: input.source ?? "manual",
    source_url: input.sourceUrl ?? item.productUrl ?? null,
    notes: input.notes ?? item.notes ?? null,
  };
}

export async function selectWishlist(): Promise<Result<WishlistItem[]>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: toError(error.message) };
  return { data: ((data ?? []) as WishlistRow[]).map(toItem), error: null };
}

export async function insertWishlist(input: SaveWishlistInput): Promise<Result<WishlistItem>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({ ...toRow(input), status: "active" })
    .select("*")
    .single();
  if (error || !data) return { data: null, error: toError(error?.message ?? "Failed to save.") };
  return { data: toItem(data as WishlistRow), error: null };
}

export async function updateWishlist(
  id: string,
  input: SaveWishlistInput,
): Promise<Result<WishlistItem>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wishlist_items")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return { data: null, error: toError(error?.message ?? "Failed to update.") };
  return { data: toItem(data as WishlistRow), error: null };
}

export async function setWishlistStatus(
  id: string,
  status: WishlistStatus,
): Promise<Result<void>> {
  const supabase = createClient();
  const { error } = await supabase
    .from("wishlist_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { data: null, error: toError(error.message) };
  return { data: undefined as unknown as void, error: null };
}

export async function deleteWishlistRow(id: string): Promise<Result<void>> {
  const supabase = createClient();
  const { error } = await supabase.from("wishlist_items").delete().eq("id", id);
  if (error) return { data: null, error: toError(error.message) };
  return { data: undefined as unknown as void, error: null };
}
