-- 00066_create_federal_details.sql
-- 1:1 extension table for FEDERAL pipeline opportunities.
-- Mirrors bids (PUBLIC_BID/GC_CHASE) and facility_details (FACILITY).
-- Holds SAM.gov identity, Claude-extracted fields, scoring, estimate, and submission data.

CREATE TABLE federal_details (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id        uuid NOT NULL UNIQUE REFERENCES opportunities(id) ON DELETE CASCADE,

  -- SAM.gov identity
  sam_notice_id         text UNIQUE,
  solicitation_number   text,
  sam_url               text,

  -- Agency info
  department            text,
  office                text,
  contracting_officer   text,
  co_email              text,
  co_phone              text,

  -- Set-aside / classification
  set_aside_type        text,
  naics_code            text NOT NULL DEFAULT '238330',
  magnitude             text,

  -- Extraction fields (populated by Claude)
  square_footage        numeric,
  system_spec           text,
  surface_prep          text,
  bond_required         boolean NOT NULL DEFAULT false,
  bond_amount           numeric,
  bond_arranged         boolean NOT NULL DEFAULT false,
  site_visit_date       timestamptz,
  site_visit_mandatory  boolean NOT NULL DEFAULT false,
  site_visit_completed  boolean NOT NULL DEFAULT false,
  wage_determination    text,
  response_deadline     timestamptz,
  extraction_json       jsonb,
  extraction_status     text NOT NULL DEFAULT 'PENDING'
                        CHECK (extraction_status IN ('PENDING','PROCESSING','COMPLETE','FAILED')),

  -- Scoring fields (populated by Claude)
  score_recommendation  text CHECK (score_recommendation IN ('BID','WATCH','PASS')),
  score_reasons         jsonb,
  scope_fit             numeric,
  magnitude_fit         numeric,
  geography_fit         numeric,
  set_aside_advantage   numeric,
  agency_advantage      numeric,
  pricing_intel         jsonb,
  scoring_status        text NOT NULL DEFAULT 'PENDING'
                        CHECK (scoring_status IN ('PENDING','PROCESSING','COMPLETE','FAILED')),

  -- Estimate / bid package
  estimate_sqft_rate    numeric,
  estimate_mobilization numeric,
  estimate_total        numeric,
  technical_approach    text,
  past_performance      text,
  capability_statement  text,
  bid_package_url       text,

  -- Submission tracking
  submitted_at          timestamptz,
  submission_method     text,
  award_amount          numeric,

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_federal_opp_id ON federal_details(opportunity_id);
CREATE INDEX idx_federal_sam_notice ON federal_details(sam_notice_id) WHERE sam_notice_id IS NOT NULL;
CREATE INDEX idx_federal_deadline ON federal_details(response_deadline) WHERE response_deadline IS NOT NULL;

-- Guard trigger: federal_details iff FEDERAL pipeline
CREATE OR REPLACE FUNCTION trg_guard_federal_pipeline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  opp_pipeline pipeline_type;
BEGIN
  SELECT pipeline INTO opp_pipeline
    FROM opportunities
   WHERE id = NEW.opportunity_id;

  IF opp_pipeline != 'FEDERAL' THEN
    RAISE EXCEPTION 'Cannot create federal_details row: opportunity pipeline is %, expected FEDERAL', opp_pipeline;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER federal_details_pipeline_guard
  BEFORE INSERT ON federal_details
  FOR EACH ROW
  EXECUTE FUNCTION trg_guard_federal_pipeline();

-- RLS (mirrors bids/facility_details pattern)
ALTER TABLE federal_details ENABLE ROW LEVEL SECURITY;

-- Rep: full CRUD where parent opp is theirs
CREATE POLICY federal_rep_all
  ON federal_details FOR ALL
  USING (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = federal_details.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = federal_details.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ));

-- Owner: read all
CREATE POLICY federal_owner_select
  ON federal_details FOR SELECT
  USING (current_app_role() = 'owner');

-- Admin: full access
CREATE POLICY federal_admin_all
  ON federal_details FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');
