-- 00019_company_city_state.sql
-- Add city + state to companies. Region remains (legacy).

ALTER TABLE companies
  ADD COLUMN city text,
  ADD COLUMN state text;

-- View for enriched company list: location, last activity, jobs out for bid
CREATE OR REPLACE VIEW v_company_list AS
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
