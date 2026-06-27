-- 00053_refresh_company_list_view.sql
-- Recreate v_company_list so the c.* expansion picks up on_bid_list.

DROP VIEW IF EXISTS v_company_list;

CREATE VIEW v_company_list AS
SELECT
  c.*,
  (
    SELECT MAX(a.logged_at)
    FROM activities a
    JOIN opportunities o ON o.id = a.opportunity_id
    WHERE o.company_id = c.id
  ) AS last_activity_at,
  (
    SELECT COUNT(*)
    FROM opportunities o
    WHERE o.company_id = c.id
      AND o.status = 'OPEN'
      AND o.pipeline IN ('PUBLIC_BID', 'GC_CHASE')
  )::int AS jobs_out_for_bid,
  (
    SELECT COUNT(*)
    FROM opportunities o
    WHERE o.company_id = c.id
  )::int AS opp_count
FROM companies c;

GRANT SELECT ON v_company_list TO authenticated;
