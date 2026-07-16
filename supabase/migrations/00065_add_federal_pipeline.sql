-- 00065_add_federal_pipeline.sql
-- Adds FEDERAL as the 4th pipeline type and updates stage validation.

ALTER TYPE pipeline_type ADD VALUE 'FEDERAL';

-- Replace valid_stage_for_pipeline() to include FEDERAL stages.
-- Cannot use CREATE OR REPLACE on an IMMUTABLE function that changes the body,
-- so DROP + CREATE.
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
