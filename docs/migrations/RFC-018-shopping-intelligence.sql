-- RFC-018 Shopping Intelligence — ADDITIVE schema only.
--
-- Adds one table: `wishlist_items` — prospective purchases the owner is
-- considering. Purchases, wear logs, and the wardrobe already persist; the
-- derived dashboard/scores are NOT stored (recomputed on demand). Marking a
-- wishlist item purchased writes a normal row to the existing `purchases` table
-- and links it via `purchased_id`.
--
-- RLS: the app uses the Supabase anon key (no auth). A single
-- `mvp_anon_all_wishlist_items` policy mirrors the ai_cache / preference_overrides
-- / trip-table convention.
--
-- Reversible: DROP TABLE wishlist_items;
--
-- APPLIED 2026-07-12 to Wardrobe project xleqmmpxlpuawzsnaftz via Supabase MCP.
-- After this file, apply acquisitions-product-experience.sql (priority column +
-- acquisition_decisions table for the Acquisitions product hub).

create table if not exists public.wishlist_items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text,
  subcategory   text,
  brand         text,
  color         text,
  formality     text,
  material      text,
  price         numeric,
  style_tags    text[],
  occasions     text[],
  image_url     text,
  source        text not null default 'manual',   -- manual | url | image
  source_url    text,
  notes         text,
  status        text not null default 'active',    -- active | purchased | dismissed
  purchased_id  uuid,                               -- FK-by-convention to purchases(id)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists wishlist_items_status_idx on public.wishlist_items (status);

alter table public.wishlist_items enable row level security;

drop policy if exists mvp_anon_all_wishlist_items on public.wishlist_items;
create policy mvp_anon_all_wishlist_items on public.wishlist_items
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.wishlist_items to anon;
