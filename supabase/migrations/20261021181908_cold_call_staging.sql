-- 20261021181908_cold_call_staging.sql
-- Recovered from supabase_migrations.schema_migrations on 2026-10-22 (applied to production on
-- 2026-10-21 outside the repo). Content is the statement recorded at apply time.

create table if not exists public.cold_call_staging (
  batch int, added date, name text, title text, company text, city text, phone text, notes text, flag text,
  loaded_at timestamptz default now()
);
alter table public.cold_call_staging enable row level security;
