-- 00025_bid_quotes.sql
-- bid_quotes: tracks each GC we sent our number to on a public-bid project.
-- Access derived from parent opportunity ownership (same pattern as bids/activities in 00012).

CREATE TABLE bid_quotes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  gc_company_id   uuid        NOT NULL REFERENCES companies(id),
  quoted_amount   numeric,
  carried_us      boolean     NOT NULL DEFAULT false,
  gc_won_award    boolean     NOT NULL DEFAULT false,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (opportunity_id, gc_company_id)
);

CREATE INDEX idx_bid_quotes_opp ON bid_quotes (opportunity_id);

-- RLS
ALTER TABLE bid_quotes ENABLE ROW LEVEL SECURITY;

-- Rep: full CRUD where parent opp is theirs
CREATE POLICY bid_quotes_rep_all
  ON bid_quotes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = bid_quotes.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = bid_quotes.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ));

-- Owner: read all
CREATE POLICY bid_quotes_owner_select
  ON bid_quotes FOR SELECT
  USING (current_app_role() = 'owner');

-- Admin: full access
CREATE POLICY bid_quotes_admin_all
  ON bid_quotes FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON bid_quotes TO authenticated;
