-- 00067_sam_sync_and_usaspending.sql
-- Tracking tables for SAM.gov opportunity pulls and USASpending pricing intel cache.

-- ── SAM.gov sync log ──
CREATE TABLE sam_gov_sync_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at      timestamptz NOT NULL DEFAULT now(),
  synced_by      uuid NOT NULL REFERENCES auth.users(id),
  naics_codes    text[] NOT NULL,
  set_asides     text[],
  results_found  int NOT NULL DEFAULT 0,
  new_imported   int NOT NULL DEFAULT 0,
  errors         jsonb
);

ALTER TABLE sam_gov_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY sam_sync_authenticated_select
  ON sam_gov_sync_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY sam_sync_authenticated_insert
  ON sam_gov_sync_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── USASpending cache ──
CREATE TABLE usaspending_cache (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naics_code     text NOT NULL,
  agency         text,
  state          text,
  cached_at      timestamptz NOT NULL DEFAULT now(),
  awards_data    jsonb NOT NULL,
  avg_award      numeric,
  median_award   numeric,
  award_count    int
);

CREATE INDEX idx_usaspending_naics ON usaspending_cache(naics_code, agency);

ALTER TABLE usaspending_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY usaspending_authenticated_select
  ON usaspending_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY usaspending_authenticated_insert
  ON usaspending_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
