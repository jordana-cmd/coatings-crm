-- 00017_dashboard_views.sql
-- Owner dashboard KPI views. Spec §4: exactly 4 tiles.
-- NEVER blend pipelines for win rate.

-- 1. Outstanding Bid $ — open opps at Submitted/Carried/GC Awarded stage
CREATE OR REPLACE VIEW v_outstanding_bid_dollars AS
  SELECT
    o.pipeline,
    COALESCE(SUM(o.amount), 0) AS total,
    COUNT(*) AS opp_count
  FROM opportunities o
  WHERE o.status = 'OPEN'
    AND o.pipeline IN ('PUBLIC_BID', 'GC_CHASE')
    AND o.stage IN ('SUBMITTED', 'CARRIED', 'GC_AWARDED')
  GROUP BY o.pipeline;

-- 2. Win rate by motion — trailing 90 days, per pipeline, NEVER blended
CREATE OR REPLACE VIEW v_win_rate_by_motion AS
  SELECT
    pipeline,
    COUNT(*) FILTER (WHERE status = 'WON') AS wins,
    COUNT(*) FILTER (WHERE status IN ('WON', 'LOST')) AS decided,
    ROUND(
      COUNT(*) FILTER (WHERE status = 'WON')::numeric /
      NULLIF(COUNT(*) FILTER (WHERE status IN ('WON', 'LOST')), 0),
      3
    ) AS win_rate
  FROM opportunities
  WHERE updated_at >= now() - interval '90 days'
    AND status IN ('WON', 'LOST')
  GROUP BY pipeline;

-- 3. Average spread to low — PUBLIC_BID only, where tab data exists
CREATE OR REPLACE VIEW v_spread_to_low AS
  SELECT
    AVG(
      (o.amount - b.low_bid_amount) / NULLIF(b.low_bid_amount, 0)
    ) AS avg_spread,
    COUNT(*) AS sample_size
  FROM opportunities o
  JOIN bids b ON b.opportunity_id = o.id
  WHERE o.pipeline = 'PUBLIC_BID'
    AND b.bid_tab_position IS NOT NULL
    AND b.low_bid_amount IS NOT NULL
    AND b.low_bid_amount > 0
    AND o.amount IS NOT NULL;

-- 4. % of outstanding pipeline requiring a bond
CREATE OR REPLACE VIEW v_bond_exposure AS
  SELECT
    COALESCE(
      SUM(o.amount) FILTER (WHERE b.bond_required = true) /
      NULLIF(SUM(o.amount), 0),
      0
    ) AS bond_pct,
    COALESCE(SUM(o.amount) FILTER (WHERE b.bond_required = true), 0) AS bonded_dollars,
    COALESCE(SUM(o.amount), 0) AS total_dollars
  FROM opportunities o
  JOIN bids b ON b.opportunity_id = o.id
  WHERE o.status = 'OPEN'
    AND o.pipeline IN ('PUBLIC_BID', 'GC_CHASE')
    AND o.stage IN ('SUBMITTED', 'CARRIED', 'GC_AWARDED');

-- Grant views to authenticated role
GRANT SELECT ON v_outstanding_bid_dollars TO authenticated;
GRANT SELECT ON v_win_rate_by_motion TO authenticated;
GRANT SELECT ON v_spread_to_low TO authenticated;
GRANT SELECT ON v_bond_exposure TO authenticated;
