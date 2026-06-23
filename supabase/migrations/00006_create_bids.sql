-- 00006_create_bids.sql
-- Spec §2: bids table (1:1 extension for PUBLIC_BID + GC_CHASE).
--
-- Columns from §2 schema plus NEW gate-predicate columns not in §2:
--   go_no_go        — PUBLIC_BID gate (§3: "simple boolean prompt on the opp")
--   invited         — GC_CHASE gate  (§3: "boolean on opp")
--   quote_delivered  — GC_CHASE gate  (§3: Quoting → Carried)
--   sub_po_received  — GC_CHASE gate  (§3: GC Awarded → Won)
--   gc_bid_date      — locked decision (supports §3 "logged before gc bid day")
--   expected_award_date — locked decision (nullable, no default; view will COALESCE)
--
-- Placement rationale: spec §3 annotates go_no_go/invited as "on the opp," but
-- they are pipeline-specific flags. Per project convention (pipeline-specific →
-- extension table), they live here alongside gc_carried_us, gc_company_id, etc.
-- Flagged as a spec disagreement; not silently overridden.

CREATE TABLE bids (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id        uuid        NOT NULL UNIQUE REFERENCES opportunities (id) ON DELETE CASCADE,

  -- §2 columns
  bid_due_at            timestamptz,
  prebid_walk_at        timestamptz,
  prebid_walk_mandatory boolean     NOT NULL DEFAULT false,
  prebid_walk_completed boolean     NOT NULL DEFAULT false,
  plans_link            text,
  addenda_acknowledged  boolean     NOT NULL DEFAULT false,
  bond_required         boolean     NOT NULL DEFAULT false,
  bond_amount           numeric,
  bond_arranged         boolean     NOT NULL DEFAULT false,
  estimate_file_url     text,
  gc_company_id         uuid        REFERENCES companies (id),
  gc_carried_us         boolean,
  bid_tab_position      int,
  low_bid_amount        numeric,

  -- NEW: gate-predicate flags (not in §2)
  go_no_go              boolean     NOT NULL DEFAULT false,
  invited               boolean     NOT NULL DEFAULT false,
  quote_delivered        boolean     NOT NULL DEFAULT false,
  sub_po_received        boolean     NOT NULL DEFAULT false,

  -- NEW: locked decisions
  gc_bid_date           timestamptz,
  expected_award_date   date
);

CREATE INDEX idx_bids_opportunity_id  ON bids (opportunity_id);
CREATE INDEX idx_bids_bid_due_at      ON bids (bid_due_at) WHERE bid_due_at IS NOT NULL;
CREATE INDEX idx_bids_gc_company_id   ON bids (gc_company_id) WHERE gc_company_id IS NOT NULL;
