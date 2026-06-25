-- 00027_report_views.sql
-- Report views for the Reports tab. Financial rollups — must be correct.
-- All views support pipeline as a dimension (never blended except where noted).

-- ============================================================
-- Report 1: Weighted forecast next 90 days
-- Per pipeline + combined, bucketed by month of expected_close_date
-- Split: COMMITTED (win_probability >= 75) vs UPSIDE (< 75)
-- ============================================================
CREATE OR REPLACE VIEW v_weighted_forecast_90d AS
SELECT
  o.pipeline,
  date_trunc('month', o.expected_close_date)::date AS close_month,
  COALESCE(SUM(o.amount * o.win_probability / 100) FILTER (WHERE o.win_probability >= 75), 0) AS committed_weighted,
  COALESCE(SUM(o.amount * o.win_probability / 100) FILTER (WHERE o.win_probability < 75), 0) AS upside_weighted,
  COALESCE(SUM(o.amount * o.win_probability / 100), 0) AS total_weighted,
  COUNT(*) FILTER (WHERE o.win_probability >= 75) AS committed_count,
  COUNT(*) FILTER (WHERE o.win_probability < 75) AS upside_count
FROM opportunities o
WHERE o.status = 'OPEN'
  AND o.amount IS NOT NULL
  AND o.win_probability IS NOT NULL
  AND o.expected_close_date IS NOT NULL
  AND o.expected_close_date >= CURRENT_DATE
  AND o.expected_close_date < CURRENT_DATE + interval '90 days'
GROUP BY o.pipeline, date_trunc('month', o.expected_close_date);

-- ============================================================
-- Report 2: Closed-won YTD vs goal
-- Per pipeline + combined. YTD = current calendar year.
-- ============================================================
CREATE OR REPLACE VIEW v_closed_won_vs_goal AS
SELECT
  o.pipeline,
  COALESCE(SUM(o.amount), 0) AS closed_won_ytd,
  COUNT(*) AS won_count
FROM opportunities o
WHERE o.status = 'WON'
  AND o.amount IS NOT NULL
  AND EXTRACT(YEAR FROM COALESCE(o.updated_at, o.created_at)) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY o.pipeline;

-- ============================================================
-- Report 4: Customer concentration
-- SUM closed-won by company, sorted desc, with % of total
-- ============================================================
CREATE OR REPLACE VIEW v_customer_concentration AS
SELECT
  c.id AS company_id,
  c.name AS company_name,
  o.pipeline,
  COALESCE(SUM(o.amount), 0) AS won_dollars,
  COUNT(*) AS won_count
FROM opportunities o
JOIN companies c ON c.id = o.company_id
WHERE o.status = 'WON'
  AND o.amount IS NOT NULL
GROUP BY c.id, c.name, o.pipeline;

-- ============================================================
-- Report 5: Closing this month (next 30 days)
-- OPEN opps with expected_close_date within 30d
-- ============================================================
CREATE OR REPLACE VIEW v_closing_this_month AS
SELECT
  o.id,
  o.name,
  c.name AS company_name,
  o.amount,
  ROUND(o.amount * COALESCE(o.win_probability, 0) / 100) AS weighted_amount,
  o.win_probability,
  o.stage,
  o.pipeline,
  o.next_step,
  o.next_step_date,
  o.expected_close_date
FROM opportunities o
JOIN companies c ON c.id = o.company_id
WHERE o.status = 'OPEN'
  AND o.expected_close_date IS NOT NULL
  AND o.expected_close_date >= CURRENT_DATE
  AND o.expected_close_date <= CURRENT_DATE + interval '30 days'
ORDER BY ROUND(o.amount * COALESCE(o.win_probability, 0) / 100) DESC NULLS LAST;

-- ============================================================
-- Report 6: Stale / leaking deals
-- OPEN opps with no recent activity (>14d) OR no next step
-- ============================================================
CREATE OR REPLACE VIEW v_stale_leaks AS
SELECT
  o.id,
  o.name,
  c.name AS company_name,
  o.amount,
  o.stage,
  o.pipeline,
  o.next_step_date,
  (SELECT MAX(a.logged_at) FROM activities a WHERE a.opportunity_id = o.id) AS last_activity_at
FROM opportunities o
JOIN companies c ON c.id = o.company_id
WHERE o.status = 'OPEN'
  AND (
    (SELECT MAX(a.logged_at) FROM activities a WHERE a.opportunity_id = o.id) < CURRENT_TIMESTAMP - interval '14 days'
    OR o.next_step_date IS NULL
    OR o.next_step_date < CURRENT_DATE
  )
ORDER BY o.amount DESC NULLS LAST;

-- ============================================================
-- Report 7: Bids out, awaiting decision
-- PUBLIC_BID: bid_quotes where carried_us=true AND gc_won_award=false AND opp still OPEN
-- GC_CHASE/FACILITY: opps in submitted-equivalent open stages
-- ============================================================
CREATE OR REPLACE VIEW v_bid_out_awaiting AS
-- PUBLIC_BID via bid_quotes
SELECT
  o.id AS opp_id,
  o.name AS project_name,
  c.name AS company_name,
  o.pipeline,
  COALESCE(bq.quoted_amount, o.amount) AS our_number,
  b.bid_due_at AS decision_date,
  CASE WHEN b.bid_due_at IS NOT NULL
    THEN (b.bid_due_at::date - CURRENT_DATE)
    ELSE NULL
  END AS days_until,
  gc.name AS gc_name
FROM bid_quotes bq
JOIN opportunities o ON o.id = bq.opportunity_id
JOIN companies c ON c.id = o.company_id
JOIN bids b ON b.opportunity_id = o.id
JOIN companies gc ON gc.id = bq.gc_company_id
WHERE o.status = 'OPEN'
  AND o.pipeline = 'PUBLIC_BID'
  AND bq.carried_us = true
  AND bq.gc_won_award = false

UNION ALL

-- GC_CHASE: stage CARRIED or GC_AWARDED while still OPEN
SELECT
  o.id AS opp_id,
  o.name AS project_name,
  c.name AS company_name,
  o.pipeline,
  o.amount AS our_number,
  b.bid_due_at AS decision_date,
  CASE WHEN b.bid_due_at IS NOT NULL
    THEN (b.bid_due_at::date - CURRENT_DATE)
    ELSE NULL
  END AS days_until,
  NULL AS gc_name
FROM opportunities o
JOIN companies c ON c.id = o.company_id
LEFT JOIN bids b ON b.opportunity_id = o.id
WHERE o.status = 'OPEN'
  AND o.pipeline = 'GC_CHASE'
  AND o.stage IN ('CARRIED', 'GC_AWARDED')

UNION ALL

-- FACILITY: stage PROPOSAL or APPROVAL while still OPEN
SELECT
  o.id AS opp_id,
  o.name AS project_name,
  c.name AS company_name,
  o.pipeline,
  o.amount AS our_number,
  NULL AS decision_date,
  NULL AS days_until,
  NULL AS gc_name
FROM opportunities o
JOIN companies c ON c.id = o.company_id
WHERE o.status = 'OPEN'
  AND o.pipeline = 'FACILITY'
  AND o.stage IN ('PROPOSAL', 'APPROVAL')

ORDER BY days_until ASC NULLS LAST;

-- Grants
GRANT SELECT ON v_weighted_forecast_90d TO authenticated;
GRANT SELECT ON v_closed_won_vs_goal TO authenticated;
GRANT SELECT ON v_customer_concentration TO authenticated;
GRANT SELECT ON v_closing_this_month TO authenticated;
GRANT SELECT ON v_stale_leaks TO authenticated;
GRANT SELECT ON v_bid_out_awaiting TO authenticated;
