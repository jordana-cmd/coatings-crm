-- 00051_cadence_engine.sql
-- Manual next-action fields for contacts (opp already has next_step + next_step_date from 00023).
-- Auto cadence is computed in TS at read time, not stored.

ALTER TABLE contacts
  ADD COLUMN next_action text,
  ADD COLUMN next_action_date date;

-- Column-level UPDATE grants (contacts already have table-level UPDATE via RLS)
GRANT UPDATE (next_action, next_action_date) ON contacts TO authenticated;
