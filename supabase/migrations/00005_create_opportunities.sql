-- 00005_create_opportunities.sql
-- Spec §2: opportunities table (the heart — one row per job-per-motion).
-- Hard invariants from spec §9 enforced via CHECK constraints.

CREATE TABLE opportunities (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text          NOT NULL,
  pipeline         pipeline_type NOT NULL,
  stage            text          NOT NULL,
  amount           numeric,
  owner_id         uuid          NOT NULL REFERENCES auth.users (id),
  company_id       uuid          NOT NULL REFERENCES companies (id),
  job_site_address text          NOT NULL,
  job_site_lat     numeric,
  job_site_lng     numeric,
  project_tag      text,
  prevailing_wage  boolean,
  status           opp_status    NOT NULL DEFAULT 'OPEN',
  lost_reason      text,
  revisit_date     date,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz,

  -- §9: stage must belong to pipeline's stage set
  CONSTRAINT chk_stage_in_pipeline
    CHECK (valid_stage_for_pipeline(pipeline, stage)),

  -- §9: GC_CHASE + LOST requires lost_reason
  CONSTRAINT chk_gc_chase_lost_reason
    CHECK (NOT (pipeline = 'GC_CHASE' AND status = 'LOST' AND lost_reason IS NULL)),

  -- §9: FACILITY + NURTURE requires revisit_date
  CONSTRAINT chk_facility_nurture_revisit
    CHECK (NOT (pipeline = 'FACILITY' AND status = 'NURTURE' AND revisit_date IS NULL))
);

CREATE INDEX idx_opps_pipeline        ON opportunities (pipeline);
CREATE INDEX idx_opps_status          ON opportunities (status);
CREATE INDEX idx_opps_owner_id        ON opportunities (owner_id);
CREATE INDEX idx_opps_company_id      ON opportunities (company_id);
CREATE INDEX idx_opps_project_tag     ON opportunities (project_tag) WHERE project_tag IS NOT NULL;
CREATE INDEX idx_opps_stage           ON opportunities (pipeline, stage);
