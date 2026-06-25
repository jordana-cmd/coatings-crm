-- 00033_bids_value_goal_type.sql
-- Add BIDS_SUBMITTED_VALUE goal type (dollar sum of bids submitted in period).
-- Re-create the CHECK constraint with the additional value.

ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_goal_type_check;
ALTER TABLE goals ADD CONSTRAINT goals_goal_type_check
  CHECK (goal_type IN ('REVENUE_WON','BIDS_SUBMITTED','BIDS_SUBMITTED_VALUE','WALKS_ATTENDED','OPPS_SOURCED','PROPOSALS_SENT'));
