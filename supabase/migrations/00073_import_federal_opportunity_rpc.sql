-- 00073_import_federal_opportunity_rpc.sql
-- Import one selected SAM.gov opportunity as a FEDERAL opp at stage INTAKE.
-- One call per selected item; a single function invocation is atomic, so the
-- company find-or-create + opportunities insert + federal_details insert
-- commit or roll back together (satisfies the extension-row-in-one-
-- transaction rule from CLAUDE.md).
--
-- SECURITY INVOKER (same pattern as create_opportunity): auth.uid() resolves
-- to the calling rep, so ownership attribution and RLS both work unchanged.
-- Reps can insert companies via companies_rep_insert (00013).
--
-- Dedup is DB-enforced by idx_federal_solicitation_number_unique (00072):
-- a second import of the same solicitation_number raises unique_violation,
-- which the Edge Function reports per-item without failing the batch.

CREATE OR REPLACE FUNCTION import_federal_opportunity(
  p_title               text,
  p_agency_name         text,
  p_solicitation_number text,
  p_sam_notice_id       text        DEFAULT NULL,
  p_sam_url             text        DEFAULT NULL,
  p_department          text        DEFAULT NULL,
  p_office              text        DEFAULT NULL,
  p_naics_code          text        DEFAULT NULL,
  p_set_aside_type      text        DEFAULT NULL,
  p_posted_date         timestamptz DEFAULT NULL,
  p_response_deadline   timestamptz DEFAULT NULL,
  p_description_text    text        DEFAULT NULL,
  p_contracting_officer text        DEFAULT NULL,
  p_co_email            text        DEFAULT NULL,
  p_co_phone            text        DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_company_id uuid;
  v_opp_id     uuid;
BEGIN
  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;
  IF p_solicitation_number IS NULL OR btrim(p_solicitation_number) = '' THEN
    RAISE EXCEPTION 'solicitation_number is required';
  END IF;

  -- Find-or-create the agency company. No unique constraint on
  -- companies.name, so a concurrent import of the same new agency could
  -- create a duplicate — accepted for a manual, low-concurrency pull.
  SELECT id INTO v_company_id
    FROM companies
   WHERE name = coalesce(nullif(btrim(p_agency_name), ''), 'Unknown Federal Agency')
     AND type = 'GOVERNMENT_AGENCY'
   LIMIT 1;

  IF v_company_id IS NULL THEN
    INSERT INTO companies (name, type, region, address)
    VALUES (
      coalesce(nullif(btrim(p_agency_name), ''), 'Unknown Federal Agency'),
      'GOVERNMENT_AGENCY',
      'US',
      'See SAM.gov listing'
    )
    RETURNING id INTO v_company_id;
  END IF;

  INSERT INTO opportunities (name, pipeline, stage, status, owner_id, company_id, job_site_address)
  VALUES (p_title, 'FEDERAL', 'INTAKE', 'OPEN', auth.uid(), v_company_id, 'See SAM.gov listing')
  RETURNING id INTO v_opp_id;

  INSERT INTO federal_details (
    opportunity_id,
    solicitation_number,
    sam_notice_id,
    sam_url,
    department,
    office,
    naics_code,
    set_aside_type,
    posted_date,
    response_deadline,
    description_text,
    contracting_officer,
    co_email,
    co_phone
  )
  VALUES (
    v_opp_id,
    btrim(p_solicitation_number),
    p_sam_notice_id,
    p_sam_url,
    p_department,
    p_office,
    coalesce(p_naics_code, '238330'),
    p_set_aside_type,
    p_posted_date,
    p_response_deadline,
    p_description_text,
    p_contracting_officer,
    p_co_email,
    p_co_phone
  );

  RETURN v_opp_id;
END;
$$;
