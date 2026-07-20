-- 00075_competitor_bids.sql
-- competitor_bids: rival contractors' numbers on a bid we lost, typically taken
-- from a published bid tabulation. bidder_name is freeform — these firms are
-- usually not in companies, so there is no FK to it.
-- Access derived from parent opportunity ownership (same pattern as bid_quotes in 00025).
--
-- Deliberately stage-agnostic: the UI surfaces this on stage = LOST, but nothing
-- here restricts it, so a Won-side variant needs no migration.
--
-- NOTE: bids.low_bid_amount / bids.bid_tab_position already capture a partial
-- version of this (and v_spread_to_low reads them). This table is the superset;
-- re-pointing that view is intentionally left for a later pass.

CREATE TABLE competitor_bids (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  bidder_name     text        NOT NULL CHECK (btrim(bidder_name) <> ''),
  amount          numeric     NOT NULL CHECK (amount > 0),
  is_winner       boolean     NOT NULL DEFAULT false,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        REFERENCES auth.users(id) DEFAULT auth.uid(),

  -- Idempotency: a double-submit cannot create the same bidder twice.
  -- Case- and whitespace-sensitive by design.
  UNIQUE (opportunity_id, bidder_name)
);

CREATE INDEX idx_competitor_bids_opp ON competitor_bids (opportunity_id);

-- At most one winner per opportunity. Reversible: DROP INDEX to relax.
CREATE UNIQUE INDEX idx_competitor_bids_one_winner
  ON competitor_bids (opportunity_id)
  WHERE is_winner;

-- ── RLS (mirrors bid_quotes) ──
ALTER TABLE competitor_bids ENABLE ROW LEVEL SECURITY;

-- Rep: full CRUD where parent opp is theirs
CREATE POLICY competitor_bids_rep_all
  ON competitor_bids FOR ALL
  USING (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = competitor_bids.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = competitor_bids.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ));

-- Owner: read all
CREATE POLICY competitor_bids_owner_select
  ON competitor_bids FOR SELECT
  USING (current_app_role() = 'owner');

-- Admin: full access
CREATE POLICY competitor_bids_admin_all
  ON competitor_bids FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON competitor_bids TO authenticated;

-- Transactional winner swap: clearing the previous winner and setting the new
-- one must be atomic, or idx_competitor_bids_one_winner rejects the intermediate
-- state. SECURITY INVOKER so the caller's RLS still applies.
CREATE OR REPLACE FUNCTION set_competitor_bid_winner(p_bid_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_opp_id uuid;
BEGIN
  SELECT opportunity_id INTO v_opp_id FROM competitor_bids WHERE id = p_bid_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competitor bid not found: %', p_bid_id;
  END IF;

  -- Clear first so the partial unique index never sees two winners.
  UPDATE competitor_bids SET is_winner = false
   WHERE opportunity_id = v_opp_id AND is_winner AND id <> p_bid_id;

  UPDATE competitor_bids SET is_winner = true WHERE id = p_bid_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_competitor_bid_winner(uuid) TO authenticated;

-- ── Rollback (run manually; repo migrations are forward-only) ──
-- DROP FUNCTION IF EXISTS set_competitor_bid_winner(uuid);
-- DROP TABLE IF EXISTS competitor_bids;  -- indexes + policies drop with it
