-- 00074_place_of_performance.sql
-- Captures SAM.gov placeOfPerformance on federal_details. pop_state is the
-- USPS state code the eligibility evaluator (companyProfile.ts) consumes.
--
-- Rollback: DROP the four pop_* columns and re-create
-- import_federal_opportunity from 00073 (additive change, no data loss on
-- existing columns).

ALTER TABLE federal_details
  ADD COLUMN pop_city text,
  ADD COLUMN pop_state text,
  ADD COLUMN pop_zip text,
  ADD COLUMN pop_country text;

-- CREATE OR REPLACE with added parameters would create an *overload* of the
-- 00073 signature, making PostgREST RPC calls ambiguous — drop the old
-- signature first.
DROP FUNCTION IF EXISTS import_federal_opportunity(
  text, text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, text, text, text, text
);

CREATE FUNCTION import_federal_opportunity(
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
  p_co_phone            text        DEFAULT NULL,
  p_pop_city            text        DEFAULT NULL,
  p_pop_state           text        DEFAULT NULL,
  p_pop_zip             text        DEFAULT NULL,
  p_pop_country         text        DEFAULT NULL
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
  VALUES (
    p_title, 'FEDERAL', 'INTAKE', 'OPEN', auth.uid(), v_company_id,
    -- Use the real place of performance when we have one
    coalesce(
      nullif(concat_ws(', ', nullif(btrim(p_pop_city), ''), nullif(btrim(p_pop_state), '')), ''),
      'See SAM.gov listing'
    )
  )
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
    co_phone,
    pop_city,
    pop_state,
    pop_zip,
    pop_country
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
    p_co_phone,
    nullif(btrim(coalesce(p_pop_city, '')), ''),
    upper(nullif(btrim(coalesce(p_pop_state, '')), '')),
    nullif(btrim(coalesce(p_pop_zip, '')), ''),
    nullif(btrim(coalesce(p_pop_country, '')), '')
  );

  RETURN v_opp_id;
END;
$$;
