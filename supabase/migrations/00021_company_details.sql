-- 00021_company_details.sql
-- Part A: new detail fields on companies
-- Part B: live KPI view per company with per-pipeline win rate

-- Part A
ALTER TABLE companies
  ADD COLUMN phone text,
  ADD COLUMN email text,
  ADD COLUMN linkedin_url text,
  ADD COLUMN address_line1 text,
  ADD COLUMN zip text,
  ADD COLUMN status text,
  ADD COLUMN planroom_url text;

-- Status CHECK: prospect/active/customer/dormant/lost
ALTER TABLE companies
  ADD CONSTRAINT chk_company_status
  CHECK (status IS NULL OR status IN ('prospect','active','customer','dormant','lost'));

-- Part B: company KPIs view with per-pipeline breakdown
CREATE OR REPLACE VIEW v_company_kpis AS
SELECT
  c.id AS company_id,
  -- Totals across bid pipelines
  COALESCE(SUM(o.amount) FILTER (WHERE o.pipeline IN ('PUBLIC_BID','GC_CHASE')), 0) AS total_bid_dollars,
  COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'WON'), 0) AS total_won_dollars,
  AVG(o.amount) FILTER (WHERE o.pipeline IN ('PUBLIC_BID','GC_CHASE') AND o.amount IS NOT NULL) AS avg_bid_size,
  -- Blended win rate (supplementary — per-pipeline is primary)
  COALESCE(
    SUM(o.amount) FILTER (WHERE o.status = 'WON') /
    NULLIF(SUM(o.amount) FILTER (WHERE o.status IN ('WON','LOST')), 0),
    0
  ) AS win_rate_dollars,
  ROUND(
    COUNT(*) FILTER (WHERE o.status = 'WON')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE o.status IN ('WON','LOST')), 0),
    3
  ) AS win_rate_count,
  -- Per-pipeline win rates (NEVER blended — spec mandate)
  ROUND(
    COUNT(*) FILTER (WHERE o.status = 'WON' AND o.pipeline = 'PUBLIC_BID')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE o.status IN ('WON','LOST') AND o.pipeline = 'PUBLIC_BID'), 0),
    3
  ) AS win_rate_public_bid,
  ROUND(
    COUNT(*) FILTER (WHERE o.status = 'WON' AND o.pipeline = 'GC_CHASE')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE o.status IN ('WON','LOST') AND o.pipeline = 'GC_CHASE'), 0),
    3
  ) AS win_rate_gc_chase,
  ROUND(
    COUNT(*) FILTER (WHERE o.status = 'WON' AND o.pipeline = 'FACILITY')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE o.status IN ('WON','LOST') AND o.pipeline = 'FACILITY'), 0),
    3
  ) AS win_rate_facility,
  -- Counts for context
  COUNT(*) FILTER (WHERE o.status = 'WON') AS won_count,
  COUNT(*) FILTER (WHERE o.status IN ('WON','LOST')) AS decided_count
FROM companies c
LEFT JOIN opportunities o ON o.company_id = c.id
GROUP BY c.id;

GRANT SELECT ON v_company_kpis TO authenticated;
