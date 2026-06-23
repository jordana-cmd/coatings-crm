-- 00004_create_stage_validation.sql
-- Immutable function used in CHECK constraint on opportunities.stage.
-- Encodes the valid stage sets per pipeline from spec §3.
--
-- PUBLIC_BID:  Sourced -> Estimating -> Submitted -> Awarded | Lost
-- GC_CHASE:   On the List -> Quoting -> Carried -> GC Awarded -> Won | Lost
-- FACILITY:   Engaged -> Site Walk -> Proposal -> Approval -> Won | Lost | Nurture

CREATE OR REPLACE FUNCTION valid_stage_for_pipeline(p pipeline_type, s text)
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
    ELSE false
  END;
$$;
