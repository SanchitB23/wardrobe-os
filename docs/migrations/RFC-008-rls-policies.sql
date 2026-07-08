-- RFC-008 / C1 — Additive RLS policies (anon, no-auth MVP posture).
--
-- Status: APPLIED to the live "Wardrobe" project (xleqmmpxlpuawzsnaftz) on 2026-07-08.
--
-- Why: the app wipes-and-reinserts item relation rows on every item edit
-- (json-sync.repository.ts) and reads/deletes care_profiles, but these tables
-- had only SELECT/INSERT anon policies. The missing DELETE silently affected 0
-- rows (stale relations accumulated); care_profiles had no SELECT (care info
-- never displayed) and no DELETE (PK violation on the 2nd edit). No schema/column
-- change — policy additions only, matching the existing mvp_anon_* convention.

-- DELETE on the six item-relation junction tables.
create policy mvp_anon_delete_item_materials on public.item_materials for delete to anon using (true);
create policy mvp_anon_delete_item_seasons   on public.item_seasons   for delete to anon using (true);
create policy mvp_anon_delete_item_styles    on public.item_styles    for delete to anon using (true);
create policy mvp_anon_delete_item_features  on public.item_features  for delete to anon using (true);
create policy mvp_anon_delete_item_tags      on public.item_tags      for delete to anon using (true);
create policy mvp_anon_delete_item_occasions on public.item_occasions for delete to anon using (true);

-- SELECT + DELETE on care_profiles (item_id is the PK; INSERT already exists).
create policy mvp_anon_select_care_profiles on public.care_profiles for select to anon using (true);
create policy mvp_anon_delete_care_profiles on public.care_profiles for delete to anon using (true);
