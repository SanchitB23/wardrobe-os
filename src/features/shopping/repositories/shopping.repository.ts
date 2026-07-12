/**
 * Shopping repository (RFC-018 + Acquisitions UX + RFC-018C) — the only code
 * touching `wishlist_items`. Reads/writes via the Supabase anon client (anon
 * RLS); maps rows ⇄ the persisted `WishlistItem` shape. No domain logic.
 */

import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { BuyVsSkipInputSource } from "@/domain/acquisition";
import type { WishlistPriority, WishlistStatus } from "@/domain/shopping";
import type {
  SaveWishlistInput,
  WishlistItem,
} from "@/features/shopping/types";

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
  image_storage_path: string | null;
  source: string;
  source_url: string | null;
  notes: string | null;
  status: string;
  priority: string | null;
  purchased_id: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  inventory_item_id: string | null;
  created_at: string;
  updated_at: string;
};

function parsePriority(value: string | null | undefined): WishlistPriority {
  if (value === "low" || value === "high" || value === "medium") return value;
  return "medium";
}

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
    imageStoragePath: row.image_storage_path,
    notes: row.notes,
    status: row.status as WishlistStatus,
    priority: parsePriority(row.priority),
    purchasedId: row.purchased_id,
    purchasePrice: row.purchase_price,
    purchaseDate: row.purchase_date,
    inventoryItemId: row.inventory_item_id,
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
    style_tags:
      item.styleTags && item.styleTags.length > 0 ? item.styleTags : null,
    occasions:
      item.intendedOccasions && item.intendedOccasions.length > 0
        ? item.intendedOccasions
        : null,
    image_url: input.imageUrl ?? null,
    image_storage_path: input.imageStoragePath ?? null,
    source: input.source ?? "manual",
    source_url: input.sourceUrl ?? item.productUrl ?? null,
    notes: input.notes ?? item.notes ?? null,
    priority: input.priority ?? "medium",
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

export async function selectWishlistById(
  id: string,
): Promise<Result<WishlistItem>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) {
    return {
      data: null,
      error: toError(error?.message ?? "Wishlist item not found."),
    };
  }
  return { data: toItem(data as WishlistRow), error: null };
}

export async function insertWishlist(
  input: SaveWishlistInput,
): Promise<Result<WishlistItem>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({
      ...toRow(input),
      status: input.status ?? "active",
      purchase_price: input.purchasePrice ?? null,
      purchase_date: input.purchaseDate ?? null,
      inventory_item_id: input.inventoryItemId ?? null,
      purchased_id: input.purchasedId ?? null,
    })
    .select("*")
    .single();
  if (error || !data)
    return { data: null, error: toError(error?.message ?? "Failed to save.") };
  return { data: toItem(data as WishlistRow), error: null };
}

export async function updateWishlist(
  id: string,
  input: SaveWishlistInput,
): Promise<Result<WishlistItem>> {
  const supabase = createClient();
  const patch = {
    ...toRow(input),
    updated_at: new Date().toISOString(),
    ...(input.status ? { status: input.status } : {}),
    ...(input.purchasePrice !== undefined
      ? { purchase_price: input.purchasePrice }
      : {}),
    ...(input.purchaseDate !== undefined
      ? { purchase_date: input.purchaseDate }
      : {}),
    ...(input.inventoryItemId !== undefined
      ? { inventory_item_id: input.inventoryItemId }
      : {}),
    ...(input.purchasedId !== undefined
      ? { purchased_id: input.purchasedId }
      : {}),
  };
  const { data, error } = await supabase
    .from("wishlist_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data)
    return {
      data: null,
      error: toError(error?.message ?? "Failed to update."),
    };
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

export async function patchWishlistFields(
  id: string,
  patch: {
    status?: WishlistStatus;
    purchasePrice?: number | null;
    purchaseDate?: string | null;
    purchasedId?: string | null;
    inventoryItemId?: string | null;
    imageUrl?: string | null;
    imageStoragePath?: string | null;
  },
): Promise<Result<WishlistItem>> {
  const supabase = createClient();
  const row: {
    updated_at: string;
    status?: string;
    purchase_price?: number | null;
    purchase_date?: string | null;
    purchased_id?: string | null;
    inventory_item_id?: string | null;
    image_url?: string | null;
    image_storage_path?: string | null;
  } = {
    updated_at: new Date().toISOString(),
  };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.purchasePrice !== undefined)
    row.purchase_price = patch.purchasePrice;
  if (patch.purchaseDate !== undefined) row.purchase_date = patch.purchaseDate;
  if (patch.purchasedId !== undefined) row.purchased_id = patch.purchasedId;
  if (patch.inventoryItemId !== undefined)
    row.inventory_item_id = patch.inventoryItemId;
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
  if (patch.imageStoragePath !== undefined)
    row.image_storage_path = patch.imageStoragePath;

  const { data, error } = await supabase
    .from("wishlist_items")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    return {
      data: null,
      error: toError(error?.message ?? "Failed to update wishlist."),
    };
  }
  return { data: toItem(data as WishlistRow), error: null };
}

export async function setWishlistPriority(
  id: string,
  priority: WishlistPriority,
): Promise<Result<void>> {
  const supabase = createClient();
  const { error } = await supabase
    .from("wishlist_items")
    .update({ priority, updated_at: new Date().toISOString() })
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

/** Exported for unit tests — priority column round-trip mapping. */
export function mapWishlistPriorityForTest(row: {
  priority: string | null;
}): WishlistPriority {
  return parsePriority(row.priority);
}
