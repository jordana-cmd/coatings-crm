-- 00079_cowork_write_rpcs.sql
-- Server-side write path for the Cowork agent (fronted by the cowork-write Edge Function).
-- Extracts create_opportunity's body into an explicit-owner core, then adds two SECURITY DEFINER
-- wrappers the token-authed function calls. advance_stage is fronted directly (unchanged).
-- No changes to advance_stage / import_planhub_deal / import_federal_opportunity.

-- 1. Core: create_opportunity's exact behavior, but with an explicit owner instead of auth.uid().
--    Single source of truth for entry stages + the same-transaction extension-row insert.
CREATE OR REPLACE FUNCTION public.create_opportunity_core(
  p_owner uuid, p_name text, p_pipeline pipeline_type,
  p_company_id uuid, p_job_site_address text, p_amount numeric DEFAULT NULL::numeric
) RETURNS uuid LANGUAGE plpgsql AS $function$
DECLARE v_opp_id uuid; v_stage text;
BEGIN
  v_stage := CASE p_pipeline
    WHEN 'PUBLIC_BID' THEN 'SOURCED'
    WHEN 'GC_CHASE'   THEN 'QUALIFIED'
    WHEN 'FACILITY'   THEN 'ENGAGED'
    WHEN 'FEDERAL'    THEN 'INTAKE'
  END;
  INSERT INTO opportunities (name, pipeline, stage, status, owner_id, company_id, job_site_address, amount)
  VALUES (p_name, p_pipeline, v_stage, 'OPEN', p_owner, p_company_id, p_job_site_address, p_amount)
  RETURNING id INTO v_opp_id;
  IF p_pipeline IN ('PUBLIC_BID','GC_CHASE') THEN
    INSERT INTO bids (opportunity_id) VALUES (v_opp_id);
  ELSIF p_pipeline = 'FACILITY' THEN
    INSERT INTO facility_details (opportunity_id) VALUES (v_opp_id);
  ELSIF p_pipeline = 'FEDERAL' THEN
    INSERT INTO federal_details (opportunity_id) VALUES (v_opp_id);
  END IF;
  RETURN v_opp_id;
END; $function$;

-- 2. create_opportunity: unchanged signature/behavior — now a thin wrapper over the core.
CREATE OR REPLACE FUNCTION public.create_opportunity(
  p_name text, p_pipeline pipeline_type, p_company_id uuid, p_job_site_address text, p_amount numeric DEFAULT NULL::numeric
) RETURNS uuid LANGUAGE plpgsql AS $function$
BEGIN
  RETURN create_opportunity_core(auth.uid(), p_name, p_pipeline, p_company_id, p_job_site_address, p_amount);
END; $function$;

-- 3. cowork_create_opportunity: token-agent create. Explicit owner; company resolved/created in the
--    same transaction; FEDERAL is solicitation-deduped. SECURITY DEFINER (service-role invocation).
CREATE OR REPLACE FUNCTION public.cowork_create_opportunity(
  p_owner uuid,
  p_name text,
  p_pipeline pipeline_type,
  p_job_site_address text,
  p_amount numeric DEFAULT NULL::numeric,
  p_company_id uuid DEFAULT NULL,
  p_company_name text DEFAULT NULL,
  p_company_type company_type DEFAULT NULL,
  p_company_email text DEFAULT NULL,
  p_company_region text DEFAULT NULL,
  p_company_address text DEFAULT NULL,
  p_solicitation_number text DEFAULT NULL
) RETURNS TABLE(status text, opportunity_id uuid, company_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_email    text := nullif(btrim(p_company_email), '');
  v_sol      text := nullif(btrim(p_solicitation_number), '');
  v_name     text := nullif(btrim(p_company_name), '');
  v_is_fed   boolean := (p_pipeline = 'FEDERAL');
  v_company  uuid;
  v_existing uuid;
  v_opp      uuid;
  v_type     company_type;
  v_region   text;
  v_address  text;
BEGIN
  IF p_owner IS NULL THEN RAISE EXCEPTION 'p_owner is required'; END IF;
  IF nullif(btrim(p_name), '') IS NULL THEN RAISE EXCEPTION 'name is required'; END IF;
  IF nullif(btrim(p_job_site_address), '') IS NULL THEN RAISE EXCEPTION 'job_site_address is required'; END IF;

  -- FEDERAL dedup invariant: solicitation_number required; dedup BEFORE any insert.
  IF v_is_fed THEN
    IF v_sol IS NULL THEN
      RAISE EXCEPTION 'p_solicitation_number is required for FEDERAL opportunities (SAM dedup invariant: federal opps dedup on solicitation_number)';
    END IF;
    SELECT fd.opportunity_id INTO v_existing FROM federal_details fd WHERE fd.solicitation_number = v_sol;
    IF v_existing IS NOT NULL THEN
      SELECT o.company_id INTO v_company FROM opportunities o WHERE o.id = v_existing;
      RETURN QUERY SELECT 'exists'::text, v_existing, v_company; RETURN;
    END IF;
  END IF;

  -- Resolve the company in the same transaction.
  IF p_company_id IS NOT NULL THEN
    v_company := p_company_id;
  ELSIF v_email IS NOT NULL THEN
    SELECT id INTO v_company FROM companies WHERE lower(email) = lower(v_email) LIMIT 1;
  ELSIF v_is_fed AND v_name IS NOT NULL THEN
    -- mirror import_federal_opportunity: find the agency by name + type
    SELECT id INTO v_company FROM companies WHERE name = v_name AND type = 'GOVERNMENT_AGENCY' LIMIT 1;
  END IF;

  IF v_company IS NULL THEN
    v_type    := COALESCE(p_company_type, CASE WHEN v_is_fed THEN 'GOVERNMENT_AGENCY'::company_type ELSE 'GC'::company_type END);
    v_region  := COALESCE(nullif(btrim(p_company_region), ''),  CASE WHEN v_is_fed THEN 'US'                  ELSE 'MI' END);
    v_address := COALESCE(nullif(btrim(p_company_address), ''), CASE WHEN v_is_fed THEN 'See SAM.gov listing' ELSE 'Unknown (set in CRM)' END);
    IF v_name IS NULL THEN
      IF v_is_fed THEN v_name := 'Unknown Federal Agency';
      ELSE RAISE EXCEPTION 'company_name (or company_id / company_email) is required to create a company';
      END IF;
    END IF;
    INSERT INTO companies (name, type, region, address, email)
    VALUES (v_name, v_type, v_region, v_address, v_email)
    RETURNING id INTO v_company;
  END IF;

  -- Opportunity + its extension row, one transaction, explicit owner.
  v_opp := create_opportunity_core(p_owner, p_name, p_pipeline, v_company, p_job_site_address, p_amount);

  IF v_is_fed THEN
    UPDATE federal_details SET solicitation_number = v_sol WHERE federal_details.opportunity_id = v_opp;
  END IF;

  RETURN QUERY SELECT 'created'::text, v_opp, v_company; RETURN;
END; $function$;

GRANT EXECUTE ON FUNCTION public.cowork_create_opportunity(
  uuid, text, pipeline_type, text, numeric, uuid, text, company_type, text, text, text, text
) TO service_role;

-- 4. cowork_log_activity: single activity insert as the designated owner.
CREATE OR REPLACE FUNCTION public.cowork_log_activity(
  p_owner uuid, p_opportunity_id uuid, p_type activity_type,
  p_note text DEFAULT NULL, p_next_action text DEFAULT NULL, p_next_action_at date DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_id uuid;
BEGIN
  IF p_owner IS NULL THEN RAISE EXCEPTION 'p_owner is required'; END IF;
  IF p_opportunity_id IS NULL THEN RAISE EXCEPTION 'p_opportunity_id is required'; END IF;
  INSERT INTO activities (opportunity_id, user_id, type, note, next_action, next_action_at, logged_at)
  VALUES (p_opportunity_id, p_owner, p_type,
          nullif(btrim(p_note), ''), nullif(btrim(p_next_action), ''), p_next_action_at, now())
  RETURNING id INTO v_id;
  RETURN v_id;
END; $function$;

GRANT EXECUTE ON FUNCTION public.cowork_log_activity(uuid, uuid, activity_type, text, text, date) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (forward-only repo):
--   -- restore the original inline create_opportunity body (git: pre-00079):
--   CREATE OR REPLACE FUNCTION create_opportunity(text, pipeline_type, uuid, text, numeric) ... (auth.uid() inline)
--   DROP FUNCTION IF EXISTS cowork_create_opportunity(uuid,text,pipeline_type,text,numeric,uuid,text,company_type,text,text,text,text);
--   DROP FUNCTION IF EXISTS cowork_log_activity(uuid,uuid,activity_type,text,text,date);
--   DROP FUNCTION IF EXISTS create_opportunity_core(uuid,text,pipeline_type,uuid,text,numeric);
-- ─────────────────────────────────────────────────────────────────────────────
