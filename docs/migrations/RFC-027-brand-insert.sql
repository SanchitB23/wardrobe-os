-- docs/migrations/RFC-027-brand-insert.sql
-- RFC-027 Inline Brand Creation. Additive: makes `brands` the first
-- product-writable lookup (anon INSERT), guarded by a case/whitespace-
-- insensitive unique index. Consistent with the app's no-auth anon model.

create policy "mvp_anon_insert_brands"
  on public.brands for insert
  to anon
  with check (true);

create unique index if not exists brands_name_ci_unique
  on public.brands (lower(btrim(name)));
