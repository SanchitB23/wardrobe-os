-- RFC-018C Acquisition-to-Inventory Pipeline — ADDITIVE schema only.
--
-- Extends `wishlist_items` with purchase-intent fields, inventory link, and
-- durable image candidate path so analysis → wishlist → purchased → inventory
-- can be linked without name-matching alone.
--
-- Existing columns reused (no change):
--   acquisition_decisions.wishlist_item_id
--   wishlist_items.purchased_id
--   wishlist_items.image_url
--   wishlist_items.source
--
-- RLS: columns inherit existing `mvp_anon_all_wishlist_items` policy.
--
-- Reversible:
--   alter table public.wishlist_items
--     drop column if exists inventory_item_id,
--     drop column if exists purchase_price,
--     drop column if exists purchase_date,
--     drop column if exists image_storage_path;
--   drop index if exists wishlist_items_inventory_item_id_uidx;

-- APPLIED 2026-07-12 to Wardrobe project xleqmmpxlpuawzsnaftz via Supabase MCP.

alter table public.wishlist_items
  add column if not exists inventory_item_id uuid,
  add column if not exists purchase_price numeric,
  add column if not exists purchase_date date,
  add column if not exists image_storage_path text;

create unique index if not exists wishlist_items_inventory_item_id_uidx
  on public.wishlist_items (inventory_item_id)
  where inventory_item_id is not null;

create index if not exists wishlist_items_inventory_item_id_idx
  on public.wishlist_items (inventory_item_id)
  where inventory_item_id is not null;

-- No new tables; existing anon RLS policy on wishlist_items covers new columns.
