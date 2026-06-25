-- 00028_goals.sql
-- Goals table: revenue + activity targets, per person or company-wide.

CREATE TABLE goals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid        REFERENCES auth.users(id),
  goal_type       text        NOT NULL CHECK (goal_type IN ('REVENUE_WON','BIDS_SUBMITTED','WALKS_ATTENDED','OPPS_SOURCED','PROPOSALS_SENT')),
  pipeline        text,
  period          text        NOT NULL CHECK (period IN ('ANNUAL','QUARTERLY','MONTHLY')),
  period_year     int         NOT NULL,
  period_quarter  int         CHECK (period_quarter IS NULL OR period_quarter BETWEEN 1 AND 4),
  period_month    int         CHECK (period_month IS NULL OR period_month BETWEEN 1 AND 12),
  target_value    numeric     NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz
);

CREATE INDEX idx_goals_owner ON goals (owner_id);
CREATE INDEX idx_goals_type_period ON goals (goal_type, period, period_year);

-- RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY goals_select
  ON goals FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY goals_owner_crud
  ON goals FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY goals_company_wide_insert
  ON goals FOR INSERT
  WITH CHECK (owner_id IS NULL AND current_app_role() = 'admin');

CREATE POLICY goals_company_wide_update
  ON goals FOR UPDATE
  USING (owner_id IS NULL AND current_app_role() = 'admin');

CREATE POLICY goals_company_wide_delete
  ON goals FOR DELETE
  USING (owner_id IS NULL AND current_app_role() = 'admin');

CREATE POLICY goals_admin_all
  ON goals FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON goals TO authenticated;

-- Seed the existing $10M annual revenue goal (company-wide, all pipelines, 2027)
INSERT INTO goals (owner_id, goal_type, pipeline, period, period_year, target_value)
VALUES (NULL, 'REVENUE_WON', NULL, 'ANNUAL', 2027, 10000000);
