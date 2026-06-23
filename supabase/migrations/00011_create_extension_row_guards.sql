-- 00011_create_extension_row_guards.sql
-- Spec §9: "bids row exists iff pipeline in (PUBLIC_BID, GC_CHASE);
--           facility_details iff pipeline = FACILITY."
--
-- These are structural-integrity guards, NOT gate-predicate triggers.
-- They prevent inserting an extension row for the wrong pipeline.
-- The "must exist" direction is enforced in application code (create the
-- extension row atomically when creating the opportunity).

-- Guard: bids can only be inserted for PUBLIC_BID or GC_CHASE opps.
CREATE OR REPLACE FUNCTION trg_guard_bids_pipeline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  opp_pipeline pipeline_type;
BEGIN
  SELECT pipeline INTO opp_pipeline
    FROM opportunities
   WHERE id = NEW.opportunity_id;

  IF opp_pipeline NOT IN ('PUBLIC_BID', 'GC_CHASE') THEN
    RAISE EXCEPTION 'Cannot create bids row: opportunity pipeline is %, expected PUBLIC_BID or GC_CHASE', opp_pipeline;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bids_pipeline_guard
  BEFORE INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION trg_guard_bids_pipeline();


-- Guard: facility_details can only be inserted for FACILITY opps.
CREATE OR REPLACE FUNCTION trg_guard_facility_pipeline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  opp_pipeline pipeline_type;
BEGIN
  SELECT pipeline INTO opp_pipeline
    FROM opportunities
   WHERE id = NEW.opportunity_id;

  IF opp_pipeline != 'FACILITY' THEN
    RAISE EXCEPTION 'Cannot create facility_details row: opportunity pipeline is %, expected FACILITY', opp_pipeline;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER facility_details_pipeline_guard
  BEFORE INSERT ON facility_details
  FOR EACH ROW
  EXECUTE FUNCTION trg_guard_facility_pipeline();
