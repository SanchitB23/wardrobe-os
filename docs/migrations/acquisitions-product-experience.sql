-- Acquisitions Product Experience (pre-intelligence UX shell).
--
-- APPLY ORDER:
--   1. RFC-018-shopping-intelligence.sql  (creates wishlist_items)
--   2. this file                          (wishlist.priority + acquisition_decisions)
--
-- Additive only:
--   - `wishlist_items.priority` — user-set low | medium | high (not engine ranking)
--   - `acquisition_decisions` — silent snapshots of Buy vs Skip analyses
--
-- RLS: anon-all policies matching wishlist / trips / ai_cache MVP convention.
--
-- Reversible:
--   ALTER TABLE wishlist_items DROP COLUMN IF EXISTS priority;
--   DROP TABLE IF EXISTS acquisition_decisions;
--
-- APPLIED 2026-07-12 to Wardrobe project xleqmmpxlpuawzsnaftz via Supabase MCP
-- (after RFC-018 wishlist_items).

-- ---------------------------------------------------------------------------
-- Wishlist: user priority (product UX; independent of PriorityEngine scores)
-- ---------------------------------------------------------------------------

alter table public.wishlist_items
  add column if not exists priority text not null default 'medium';
  -- low | medium | high

create index if not exists wishlist_items_priority_idx
  on public.wishlist_items (priority);

-- ---------------------------------------------------------------------------
-- Decision History: persisted Buy vs Skip snapshots (engine unchanged)
-- ---------------------------------------------------------------------------

create table if not exists public.acquisition_decisions (
  id                 uuid primary key default gen_random_uuid(),
  item_name          text not null,
  item_category      text,
  item_snapshot      jsonb not null default '{}'::jsonb,
  decision           text not null,                 -- buy | consider | skip
  score              numeric,
  confidence         numeric,
  summary            text,
  analysis           jsonb not null,                -- full BuyVsSkipAnalysis
  source             text not null default 'manual', -- manual | url | image
  wishlist_item_id   uuid,                          -- optional link
  created_at         timestamptz not null default now()
);

create index if not exists acquisition_decisions_decision_created_idx
  on public.acquisition_decisions (decision, created_at desc);

create index if not exists acquisition_decisions_item_name_idx
  on public.acquisition_decisions (item_name);

alter table public.acquisition_decisions enable row level security;

drop policy if exists mvp_anon_all_acquisition_decisions on public.acquisition_decisions;
create policy mvp_anon_all_acquisition_decisions on public.acquisition_decisions
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.acquisition_decisions to anon;
