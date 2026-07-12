-- RFC-023 Ad-hoc Wear Logs & Outfit Promotion — ADDITIVE schema only.
--
-- New event-centric wear history alongside legacy per-item wear_logs.
-- Tables: wear_events (WearLog), wear_event_items (composition).
-- Do NOT drop or rewrite public.wear_logs.
--
-- RLS: anon MVP policies (mvp_anon_*), matching wear_logs / outfits posture.
--
-- Reversible:
--   DROP TABLE public.wear_event_items;
--   DROP TABLE public.wear_events;
--   DROP TYPE public.wear_log_source;
--
-- Target: Wardrobe project (apply via Supabase MCP / SQL editor).
-- APPLIED 2026-07-12 to Wardrobe project (xleqmmpxlpuawzsnaftz) via Supabase MCP.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'wear_log_source' and n.nspname = 'public'
  ) then
    create type public.wear_log_source as enum (
      'outfit',
      'ad_hoc',
      'recommendation',
      'trip',
      'ai'
    );
  end if;
end $$;

create table if not exists public.wear_events (
  id uuid primary key default gen_random_uuid(),
  worn_on date not null,
  occasion_id uuid null references public.occasions (id) on delete set null,
  outfit_id uuid null references public.outfits (id) on delete set null,
  source public.wear_log_source not null default 'ad_hoc',
  notes text null,
  weather jsonb null,
  combination_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wear_event_items (
  wear_event_id uuid not null references public.wear_events (id) on delete cascade,
  item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  slot text null,
  sort_order int not null default 0,
  primary key (wear_event_id, item_id)
);

create index if not exists wear_events_worn_on_idx
  on public.wear_events (worn_on desc);

create index if not exists wear_events_source_idx
  on public.wear_events (source);

create index if not exists wear_events_outfit_id_idx
  on public.wear_events (outfit_id)
  where outfit_id is not null;

create index if not exists wear_events_combination_key_idx
  on public.wear_events (combination_key);

create index if not exists wear_event_items_item_id_idx
  on public.wear_event_items (item_id);

alter table public.wear_events enable row level security;
alter table public.wear_event_items enable row level security;

drop policy if exists mvp_anon_select_wear_events on public.wear_events;
drop policy if exists mvp_anon_insert_wear_events on public.wear_events;
drop policy if exists mvp_anon_update_wear_events on public.wear_events;
drop policy if exists mvp_anon_delete_wear_events on public.wear_events;

create policy mvp_anon_select_wear_events
  on public.wear_events for select to anon using (true);

create policy mvp_anon_insert_wear_events
  on public.wear_events for insert to anon with check (true);

create policy mvp_anon_update_wear_events
  on public.wear_events for update to anon using (true) with check (true);

create policy mvp_anon_delete_wear_events
  on public.wear_events for delete to anon using (true);

drop policy if exists mvp_anon_select_wear_event_items on public.wear_event_items;
drop policy if exists mvp_anon_insert_wear_event_items on public.wear_event_items;
drop policy if exists mvp_anon_update_wear_event_items on public.wear_event_items;
drop policy if exists mvp_anon_delete_wear_event_items on public.wear_event_items;

create policy mvp_anon_select_wear_event_items
  on public.wear_event_items for select to anon using (true);

create policy mvp_anon_insert_wear_event_items
  on public.wear_event_items for insert to anon with check (true);

create policy mvp_anon_update_wear_event_items
  on public.wear_event_items for update to anon using (true) with check (true);

create policy mvp_anon_delete_wear_event_items
  on public.wear_event_items for delete to anon using (true);

grant select, insert, update, delete on public.wear_events to anon;
grant select, insert, update, delete on public.wear_event_items to anon;
