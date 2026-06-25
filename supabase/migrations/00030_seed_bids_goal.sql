-- 00030_seed_bids_goal.sql
-- Seed a default BIDS_SUBMITTED annual goal alongside the revenue goal.
-- Editable by the user on the Goals page.

INSERT INTO goals (owner_id, goal_type, pipeline, period, period_year, target_value)
SELECT NULL, 'BIDS_SUBMITTED', NULL, 'ANNUAL', 2027, 50
WHERE NOT EXISTS (
  SELECT 1 FROM goals WHERE goal_type = 'BIDS_SUBMITTED' AND period = 'ANNUAL' AND period_year = 2027 AND owner_id IS NULL
);
