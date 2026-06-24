-- 00018_company_contact_support.sql
-- Additive columns for completion tracking and activity-contact linking.
-- All nullable — nothing existing breaks.

-- 1. Opportunities: completion tracking for won jobs
ALTER TABLE opportunities
  ADD COLUMN completed_at date,
  ADD COLUMN completion_notes text,
  ADD COLUMN final_value numeric;

-- Guard: completed_at only valid when status = WON
ALTER TABLE opportunities
  ADD CONSTRAINT chk_completion_requires_won
  CHECK (NOT (completed_at IS NOT NULL AND status <> 'WON'));

-- 2. Activities: optional direct link to a contact
ALTER TABLE activities
  ADD COLUMN contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX idx_activities_contact_id ON activities (contact_id) WHERE contact_id IS NOT NULL;
