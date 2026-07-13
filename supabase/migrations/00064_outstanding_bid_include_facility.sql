-- 00064_outstanding_bid_include_facility.sql
-- "Outstanding Bid $" (00017) was scoped to PUBLIC_BID/GC_CHASE only, per the
-- original spec. Expanded to also include FACILITY bids awaiting a decision
-- (PROPOSAL/APPROVAL) — a Facility proposal awaiting approval is just as much
-- "out, unsure if we'll get it" as a submitted public bid or a carried GC quote.
-- v_bond_exposure is intentionally left untouched: it inner-joins the `bids`
-- extension table, which FACILITY opportunities never have (they use
-- facility_details instead), so bonding isn't tracked for that pipeline.

CREATE OR REPLACE VIEW v_outstanding_bid_dollars AS
  SELECT
    o.pipeline,
    COALESCE(SUM(o.amount), 0) AS total,
    COUNT(*) AS opp_count
  FROM opportunities o
  WHERE o.status = 'OPEN'
    AND (
      (o.pipeline IN ('PUBLIC_BID', 'GC_CHASE') AND o.stage IN ('SUBMITTED', 'CARRIED', 'GC_AWARDED'))
      OR (o.pipeline = 'FACILITY' AND o.stage IN ('PROPOSAL', 'APPROVAL'))
    )
  GROUP BY o.pipeline;
