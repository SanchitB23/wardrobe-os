-- RFC-017 Trip Planner — ADDITIVE schema only.
--
-- Promotes trips from an ephemeral wizard form into first-class, persisted,
-- reusable data. The derived LifestylePlan is NOT stored (recomputed on demand,
-- like every other engine output); only the trip *inputs* and the *packing
-- progress* persist.
--
-- Adds four tables:
--   1. trips                  — a saved trip (a template is a trip with is_template=true).
--   2. trip_cities            — ordered city legs for multi-city itineraries.
--   3. trip_events            — occasion (+ optional formality hint) on a date.
--   4. trip_packing_progress  — the tickable packing checklist state.
--
-- RLS: the app uses the Supabase anon key (no auth). Each table gets a single
-- `mvp_anon_all_*` policy, mirroring the ai_cache / preference_overrides
-- convention (SELECT/INSERT/UPDATE/DELETE for anon).
--
-- Reversible:
--   DROP TABLE trip_packing_progress, trip_events, trip_cities, trips;
--
-- NOT YET APPLIED — awaiting authorization to modify the shared Wardrobe project.

create table if not exists public.trips (
  id                uuid primary key default gen_random_uuid(),
  name              text,
  destination       text,
  start_date        date not null,
  end_date          date not null,
  travel_style      text not null default 'standard',   -- minimal | standard | overpacker
  planning_strategy text not null default 'balanced',   -- minimal | balanced | luxury | business
  laundry_available boolean not null default false,
  luggage_kind      text not null default 'carry_on',   -- carry_on | checked | unbounded
  luggage_max_items integer,                             -- optional cap for carry_on
  notes             text,
  is_template       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.trip_cities (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  city        text not null,
  start_date  date not null,
  end_date    date not null,
  sort_order  integer not null default 0
);

create table if not exists public.trip_events (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips(id) on delete cascade,
  event_date     date not null,
  occasion       text not null,
  formality_hint text
);

create table if not exists public.trip_packing_progress (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  item_id    uuid not null,             -- FK-by-convention to wardrobe_items
  packed     boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (trip_id, item_id)
);

create index if not exists trip_cities_trip_id_idx on public.trip_cities (trip_id);
create index if not exists trip_events_trip_id_idx on public.trip_events (trip_id);
create index if not exists trip_packing_progress_trip_id_idx on public.trip_packing_progress (trip_id);

-- RLS ---------------------------------------------------------------------

alter table public.trips enable row level security;
alter table public.trip_cities enable row level security;
alter table public.trip_events enable row level security;
alter table public.trip_packing_progress enable row level security;

drop policy if exists mvp_anon_all_trips on public.trips;
create policy mvp_anon_all_trips on public.trips
  for all to anon using (true) with check (true);

drop policy if exists mvp_anon_all_trip_cities on public.trip_cities;
create policy mvp_anon_all_trip_cities on public.trip_cities
  for all to anon using (true) with check (true);

drop policy if exists mvp_anon_all_trip_events on public.trip_events;
create policy mvp_anon_all_trip_events on public.trip_events
  for all to anon using (true) with check (true);

drop policy if exists mvp_anon_all_trip_packing_progress on public.trip_packing_progress;
create policy mvp_anon_all_trip_packing_progress on public.trip_packing_progress
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.trips to anon;
grant select, insert, update, delete on public.trip_cities to anon;
grant select, insert, update, delete on public.trip_events to anon;
grant select, insert, update, delete on public.trip_packing_progress to anon;
