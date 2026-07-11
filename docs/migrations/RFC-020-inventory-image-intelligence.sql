-- RFC-020 Inventory Image Intelligence — ADDITIVE schema only.
--
-- Table: item_visual_attributes — Vision-derived style cues for an inventory
-- item's primary image, reviewed by the owner (pending | accepted | rejected |
-- stale). Manual wardrobe_items fields are never overwritten by this table.
--
-- RLS: anon MVP policies (mvp_anon_*), matching item_images posture.
--
-- Reversible: DROP TABLE item_visual_attributes;
--
-- Target: Wardrobe project (apply via Supabase MCP / SQL editor).

create table if not exists public.item_visual_attributes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  image_id uuid not null references public.item_images (id) on delete cascade,

  vision_summary jsonb,

  dominant_colors jsonb,
  secondary_colors jsonb,
  pattern text,
  texture text,
  material_guess text,
  silhouette text,
  formality_guess text,
  style_tags text[] not null default '{}',

  confidence numeric not null check (confidence >= 0 and confidence <= 1),

  status text not null
    check (status in ('pending', 'accepted', 'rejected', 'stale'))
    default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  rejected_at timestamptz
);

create unique index if not exists item_visual_attributes_item_id_uidx
  on public.item_visual_attributes (item_id);

create index if not exists item_visual_attributes_status_idx
  on public.item_visual_attributes (status);

create index if not exists item_visual_attributes_image_id_idx
  on public.item_visual_attributes (image_id);

alter table public.item_visual_attributes enable row level security;

drop policy if exists mvp_anon_select_item_visual_attributes on public.item_visual_attributes;
drop policy if exists mvp_anon_insert_item_visual_attributes on public.item_visual_attributes;
drop policy if exists mvp_anon_update_item_visual_attributes on public.item_visual_attributes;
drop policy if exists mvp_anon_delete_item_visual_attributes on public.item_visual_attributes;

create policy mvp_anon_select_item_visual_attributes
  on public.item_visual_attributes for select to anon using (true);

create policy mvp_anon_insert_item_visual_attributes
  on public.item_visual_attributes for insert to anon with check (true);

create policy mvp_anon_update_item_visual_attributes
  on public.item_visual_attributes for update to anon using (true) with check (true);

create policy mvp_anon_delete_item_visual_attributes
  on public.item_visual_attributes for delete to anon using (true);

grant select, insert, update, delete on public.item_visual_attributes to anon;
