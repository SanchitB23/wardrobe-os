-- RFC-024 Catalog Review v2 — ADDITIVE schema only.
--
-- Persist dismissals for duplicate/similar pairs and optional per-item reviewed
-- flags. Does not alter wardrobe_items.
--
-- RLS: anon MVP policies (mvp_anon_*), matching inventory review posture.
--
-- Reversible:
--   DROP TABLE public.catalog_review_dismissals;
--   DROP TABLE public.catalog_review_item_state;
--
-- Target: Wardrobe project (apply via Supabase MCP / SQL editor).
-- APPLIED 2026-07-12 to Wardrobe project xleqmmpxlpuawzsnaftz via Supabase MCP.

create table if not exists public.catalog_review_dismissals (
  id uuid primary key default gen_random_uuid(),
  item_id_a uuid not null references public.wardrobe_items (id) on delete cascade,
  item_id_b uuid not null references public.wardrobe_items (id) on delete cascade,
  kind text not null check (kind in ('duplicate', 'similar')),
  reason text null,
  created_at timestamptz not null default now(),
  constraint catalog_review_dismissals_ordered check (item_id_a < item_id_b),
  constraint catalog_review_dismissals_unique unique (item_id_a, item_id_b, kind)
);

create index if not exists catalog_review_dismissals_kind_idx
  on public.catalog_review_dismissals (kind);

create table if not exists public.catalog_review_item_state (
  item_id uuid primary key references public.wardrobe_items (id) on delete cascade,
  reviewed_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.catalog_review_dismissals enable row level security;
alter table public.catalog_review_item_state enable row level security;

drop policy if exists mvp_anon_select_catalog_review_dismissals on public.catalog_review_dismissals;
drop policy if exists mvp_anon_insert_catalog_review_dismissals on public.catalog_review_dismissals;
drop policy if exists mvp_anon_update_catalog_review_dismissals on public.catalog_review_dismissals;
drop policy if exists mvp_anon_delete_catalog_review_dismissals on public.catalog_review_dismissals;

create policy mvp_anon_select_catalog_review_dismissals
  on public.catalog_review_dismissals for select to anon using (true);

create policy mvp_anon_insert_catalog_review_dismissals
  on public.catalog_review_dismissals for insert to anon with check (true);

create policy mvp_anon_update_catalog_review_dismissals
  on public.catalog_review_dismissals for update to anon using (true) with check (true);

create policy mvp_anon_delete_catalog_review_dismissals
  on public.catalog_review_dismissals for delete to anon using (true);

drop policy if exists mvp_anon_select_catalog_review_item_state on public.catalog_review_item_state;
drop policy if exists mvp_anon_insert_catalog_review_item_state on public.catalog_review_item_state;
drop policy if exists mvp_anon_update_catalog_review_item_state on public.catalog_review_item_state;
drop policy if exists mvp_anon_delete_catalog_review_item_state on public.catalog_review_item_state;

create policy mvp_anon_select_catalog_review_item_state
  on public.catalog_review_item_state for select to anon using (true);

create policy mvp_anon_insert_catalog_review_item_state
  on public.catalog_review_item_state for insert to anon with check (true);

create policy mvp_anon_update_catalog_review_item_state
  on public.catalog_review_item_state for update to anon using (true) with check (true);

create policy mvp_anon_delete_catalog_review_item_state
  on public.catalog_review_item_state for delete to anon using (true);

grant select, insert, update, delete on public.catalog_review_dismissals to anon;
grant select, insert, update, delete on public.catalog_review_item_state to anon;
