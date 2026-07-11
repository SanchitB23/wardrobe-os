-- Supabase RLS / storage audit gaps — 2026-07-12
--
-- Status: NOT APPLIED. Review before running against project xleqmmpxlpuawzsnaftz
--         ("Wardrobe"). Additive hardening only; no schema/column changes.
--
-- Context: Code × live-policy audit found zero *missing* ops for tables the app
-- uses. Gaps below are security hygiene / convention drift flagged by live
-- advisors and RFC-008 M13.
--
-- Auth model today: anon key + mvp_anon_* USING (true). That open posture is
-- intentional for single-user MVP and is NOT tightened here (needs real auth).

-- ---------------------------------------------------------------------------
-- 1. CRITICAL — revoke EXECUTE on SECURITY DEFINER event-trigger helper
-- ---------------------------------------------------------------------------
-- public.rls_auto_enable() is an event-trigger function that auto-enables RLS
-- on new public tables. Advisors flag anon/authenticated EXECUTE on SECURITY
-- DEFINER functions exposed via /rest/v1/rpc/*. Revoke from API roles; owners
-- and event triggers still work.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

-- ---------------------------------------------------------------------------
-- 2. SHOULD — normalize item_images policies to mvp_anon_* (RFC-008 M13)
-- ---------------------------------------------------------------------------
-- Live policies target role `public` (all roles) with free-form names.
-- Align with the rest of the schema: TO anon + mvp_anon_* naming.
drop policy if exists "Allow public read item images" on public.item_images;
drop policy if exists "Allow public insert item images" on public.item_images;
drop policy if exists "Allow public update item images" on public.item_images;
drop policy if exists "Allow public delete item images" on public.item_images;

create policy mvp_anon_select_item_images
  on public.item_images for select to anon using (true);

create policy mvp_anon_insert_item_images
  on public.item_images for insert to anon with check (true);

create policy mvp_anon_update_item_images
  on public.item_images for update to anon using (true) with check (true);

create policy mvp_anon_delete_item_images
  on public.item_images for delete to anon using (true);

-- ---------------------------------------------------------------------------
-- 3. SHOULD — storage.objects: anon-scoped policies + explicit UPDATE WITH CHECK
-- ---------------------------------------------------------------------------
-- Live policies use role `public` and UPDATE lacks an explicit WITH CHECK.
-- Keep SELECT (needed for createSignedUrl); bucket remains public for URL access.
-- Listing-via-SELECT is an accepted advisor WARN for public buckets until auth.
drop policy if exists "Public read wardrobe images" on storage.objects;
drop policy if exists "Allow uploads wardrobe images" on storage.objects;
drop policy if exists "Allow deletes wardrobe images" on storage.objects;
drop policy if exists "Allow updates wardrobe images" on storage.objects;

create policy mvp_anon_select_wardrobe_images
  on storage.objects for select to anon
  using (bucket_id = 'wardrobe-images');

create policy mvp_anon_insert_wardrobe_images
  on storage.objects for insert to anon
  with check (bucket_id = 'wardrobe-images');

create policy mvp_anon_update_wardrobe_images
  on storage.objects for update to anon
  using (bucket_id = 'wardrobe-images')
  with check (bucket_id = 'wardrobe-images');

create policy mvp_anon_delete_wardrobe_images
  on storage.objects for delete to anon
  using (bucket_id = 'wardrobe-images');

-- ---------------------------------------------------------------------------
-- Not included (intentional / deferred)
-- ---------------------------------------------------------------------------
-- * Replacing USING (true) write policies with ownership predicates — blocked
--   until user auth lands.
-- * Dropping unused tables (item_colors, item_weather_profile) or their SELECT
--   policies — stale but harmless; prefer a dedicated cleanup migration.
-- * Restricting public-bucket object listing further — would need signed-URL
--   / path design changes (RFC-008 N13).
