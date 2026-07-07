-- RFC-004 Personalization Engine — ADDITIVE schema only.
--
-- Adds:
--   1. wardrobe_items.protected / .avoided boolean flags (default false).
--   2. preference_overrides table (pin / adjust / suppress per dimension+value).
--
-- RLS: the app uses the Supabase anon key (no auth). New columns inherit
-- wardrobe_items' existing per-command anon policies. The new table gets a
-- single `mvp_anon_all_*` policy, mirroring the ai_cache convention.
--
-- Reversible: DROP TABLE preference_overrides; ALTER TABLE wardrobe_items DROP
-- COLUMN protected, DROP COLUMN avoided;
--
-- NOT YET APPLIED — awaiting authorization to modify the shared Wardrobe project.

alter table public.wardrobe_items
  add column if not exists protected boolean not null default false,
  add column if not exists avoided boolean not null default false;

create table if not exists public.preference_overrides (
  id uuid primary key default gen_random_uuid(),
  dimension text not null,
  value text not null,
  mode text not null check (mode in ('pin', 'adjust', 'suppress')),
  weight real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dimension, value)
);

alter table public.preference_overrides enable row level security;

drop policy if exists mvp_anon_all_preference_overrides on public.preference_overrides;
create policy mvp_anon_all_preference_overrides
  on public.preference_overrides
  for all
  to anon
  using (true)
  with check (true);

grant select, insert, update, delete on public.preference_overrides to anon;
