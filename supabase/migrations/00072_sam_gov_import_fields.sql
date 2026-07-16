-- 00072_sam_gov_import_fields.sql
-- Adds fields needed for the SAM.gov opportunity import feature.

ALTER TABLE federal_details
  ADD COLUMN posted_date timestamptz,
  ADD COLUMN description_text text;

-- Defense-in-depth dedup guard (belt-and-suspenders alongside the
-- app-level check in the import RPC). Partial index since
-- solicitation_number is nullable (non-SAM.gov federal opps won't have one).
CREATE UNIQUE INDEX idx_federal_solicitation_number_unique
  ON federal_details (solicitation_number)
  WHERE solicitation_number IS NOT NULL;

ALTER TABLE sam_gov_sync_log
  ADD COLUMN requests_used integer NOT NULL DEFAULT 0;
