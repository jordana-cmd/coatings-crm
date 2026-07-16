-- 00068_update_create_opportunity_rpc.sql
-- Adds FEDERAL pipeline support to create_opportunity().
-- FEDERAL opps start at INTAKE and get a federal_details extension row.

CREATE OR REPLACE FUNCTION create_opportunity(
  p_name           text,
  p_pipeline       pipeline_type,
  p_company_id     uuid,
  p_job_site_address text,
  p_amount         numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_opp_id uuid;
  v_stage  text;
BEGIN
  -- Determine initial stage per pipeline
  v_stage := CASE p_pipeline
    WHEN 'PUBLIC_BID' THEN 'SOURCED'
    WHEN 'GC_CHASE'   THEN 'ON_THE_LIST'
    WHEN 'FACILITY'   THEN 'ENGAGED'
    WHEN 'FEDERAL'    THEN 'INTAKE'
  END;

  INSERT INTO opportunities (name, pipeline, stage, status, owner_id, company_id, job_site_address, amount)
  VALUES (p_name, p_pipeline, v_stage, 'OPEN', auth.uid(), p_company_id, p_job_site_address, p_amount)
  RETURNING id INTO v_opp_id;

  -- Create extension row
  IF p_pipeline IN ('PUBLIC_BID', 'GC_CHASE') THEN
    INSERT INTO bids (opportunity_id) VALUES (v_opp_id);
  ELSIF p_pipeline = 'FACILITY' THEN
    INSERT INTO facility_details (opportunity_id) VALUES (v_opp_id);
  ELSIF p_pipeline = 'FEDERAL' THEN
    INSERT INTO federal_details (opportunity_id) VALUES (v_opp_id);
  END IF;

  RETURN v_opp_id;
END;
$$;
