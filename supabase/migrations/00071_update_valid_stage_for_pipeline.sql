-- 00071_update_valid_stage_for_pipeline.sql
-- Replace valid_stage_for_pipeline() to include FEDERAL stages.
-- Split out from 00065 because Postgres forbids using a new enum value
-- (FEDERAL, added in 00065) in the same transaction it was added in.
-- Cannot use CREATE OR REPLACE on an IMMUTABLE function that changes the
-- body, so DROP + CREATE. chk_stage_in_pipeline depends on it, so
-- drop/recreate that too.

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_stage_in_pipeline;

DROP FUNCTION IF EXISTS valid_stage_for_pipeline(pipeline_type, text);

CREATE FUNCTION valid_stage_for_pipeline(p pipeline_type, s text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p
    WHEN 'PUBLIC_BID' THEN s IN (
      'SOURCED', 'ESTIMATING', 'SUBMITTED', 'AWARDED', 'LOST'
    )
    WHEN 'GC_CHASE' THEN s IN (
      'ON_THE_LIST', 'QUOTING', 'CARRIED', 'GC_AWARDED', 'WON', 'LOST'
    )
    WHEN 'FACILITY' THEN s IN (
      'ENGAGED', 'SITE_WALK', 'PROPOSAL', 'APPROVAL', 'WON', 'LOST', 'NURTURE'
    )
    WHEN 'FEDERAL' THEN s IN (
      'INTAKE', 'EXTRACTION', 'SCORING', 'ESTIMATING', 'SUBMITTED', 'AWARDED', 'LOST'
    )
    ELSE false
  END;
$$;

ALTER TABLE opportunities
  ADD CONSTRAINT chk_stage_in_pipeline
  CHECK (valid_stage_for_pipeline(pipeline, stage));
