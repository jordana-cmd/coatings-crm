-- 00007_create_facility_details.sql
-- Spec §2: facility_details table (1:1 extension for FACILITY pipeline).
--
-- Columns from §2 schema plus NEW gate-predicate columns not in §2:
--   contact_made          — FACILITY gate (§3: Engaged → Site Walk)
--   proposal_delivered    — FACILITY gate (§3: Proposal → Approval)
--   po_or_capital_approval — FACILITY gate (§3: Approval → Won)

CREATE TABLE facility_details (
  id                      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id          uuid    NOT NULL UNIQUE REFERENCES opportunities (id) ON DELETE CASCADE,

  -- §2 columns
  budget_cycle            text,
  decision_maker_id       uuid    REFERENCES contacts (id),
  warranty_term           text,
  square_footage          numeric,
  survey_completed        boolean NOT NULL DEFAULT false,

  -- NEW: gate-predicate flags (not in §2)
  contact_made            boolean NOT NULL DEFAULT false,
  proposal_delivered      boolean NOT NULL DEFAULT false,
  po_or_capital_approval  boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_facility_opportunity_id ON facility_details (opportunity_id);
