-- 00080_cowork_company_name_dedup.sql
-- cowork_create_opportunity: add name+type company dedup so GC-chase creates that pass a
-- company_name (but no email) reuse an existing company instead of creating a duplicate.
-- Resolution order is now: company_id → lower(email) → lower(name)+type → create.
-- (Supersedes the FEDERAL-only name lookup in 00079; now covers all types, case-insensitive.)
-- CREATE OR REPLACE preserves the existing service_role grant.

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
  v_type     company_type := COALESCE(p_company_type, CASE WHEN p_pipeline = 'FEDERAL' THEN 'GOVERNMENT_AGENCY'::company_type ELSE 'GC'::company_type END);
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

  -- Resolve the company in the same transaction: id → email → name+type → create.
  IF p_company_id IS NOT NULL THEN
    v_company := p_company_id;
  ELSIF v_email IS NOT NULL THEN
    SELECT id INTO v_company FROM companies WHERE lower(email) = lower(v_email) LIMIT 1;
  END IF;

  -- Name-based dedup (case-insensitive, scoped to the resolved type) when still unresolved.
  IF v_company IS NULL AND v_name IS NOT NULL THEN
    SELECT id INTO v_company FROM companies WHERE lower(btrim(name)) = lower(v_name) AND type = v_type LIMIT 1;
  END IF;

  IF v_company IS NULL THEN
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

-- ROLLBACK: restore the 00079 body of cowork_create_opportunity (git: pre-00080).
