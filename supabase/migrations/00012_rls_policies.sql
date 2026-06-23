-- 00012_rls_policies.sql
-- Row-Level Security for all 8 application tables.
--
-- Roles (from user_profiles.role):
--   rep   — full CRUD on own records (scoped by opportunities.owner_id)
--   owner — read-only on everything (dashboard access)
--   admin — full CRUD on everything
--
-- RECURSION GUARD: current_app_role() is SECURITY DEFINER so it reads
-- user_profiles bypassing RLS. Without this, any policy that checks the
-- role would trigger RLS on user_profiles, which checks the role, etc.

-- ============================================================
-- 1. SECURITY DEFINER helper: current_app_role()
-- ============================================================

CREATE OR REPLACE FUNCTION current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM user_profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- 2. Enable RLS on all 8 tables
-- ============================================================

ALTER TABLE companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids             ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pins        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. user_profiles (defined FIRST so role lookup works)
-- ============================================================

-- Self: read own row (no role lookup needed — avoids recursion)
CREATE POLICY user_profiles_self_select
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

-- Admin: full access
CREATE POLICY user_profiles_admin_all
  ON user_profiles FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

-- Owner: read all profiles
CREATE POLICY user_profiles_owner_select
  ON user_profiles FOR SELECT
  USING (current_app_role() = 'owner');

-- ============================================================
-- 4. opportunities
-- ============================================================

-- Rep: full CRUD on own opps
CREATE POLICY opps_rep_all
  ON opportunities FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Owner: read all
CREATE POLICY opps_owner_select
  ON opportunities FOR SELECT
  USING (current_app_role() = 'owner');

-- Admin: full access
CREATE POLICY opps_admin_all
  ON opportunities FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

-- ============================================================
-- 5a. bids — access derived from parent opportunity
-- ============================================================

-- Rep: full CRUD where parent opp is theirs
CREATE POLICY bids_rep_all
  ON bids FOR ALL
  USING (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = bids.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = bids.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ));

-- Owner: read all
CREATE POLICY bids_owner_select
  ON bids FOR SELECT
  USING (current_app_role() = 'owner');

-- Admin: full access
CREATE POLICY bids_admin_all
  ON bids FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

-- ============================================================
-- 5b. facility_details — access derived from parent opportunity
-- ============================================================

-- Rep: full CRUD where parent opp is theirs
CREATE POLICY facility_rep_all
  ON facility_details FOR ALL
  USING (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = facility_details.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = facility_details.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ));

-- Owner: read all
CREATE POLICY facility_owner_select
  ON facility_details FOR SELECT
  USING (current_app_role() = 'owner');

-- Admin: full access
CREATE POLICY facility_admin_all
  ON facility_details FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

-- ============================================================
-- 5c. activities — access derived from parent opportunity
-- ============================================================

-- Rep: SELECT/UPDATE/DELETE on activities for their opps
CREATE POLICY activities_rep_select
  ON activities FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = activities.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ));

CREATE POLICY activities_rep_update
  ON activities FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = activities.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ));

CREATE POLICY activities_rep_delete
  ON activities FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = activities.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ));

-- Rep: INSERT — parent opp must be theirs AND user_id must be themselves
-- (prevents logging activities as someone else)
CREATE POLICY activities_rep_insert
  ON activities FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM opportunities
      WHERE opportunities.id = activities.opportunity_id
        AND opportunities.owner_id = auth.uid()
    )
  );

-- Owner: read all
CREATE POLICY activities_owner_select
  ON activities FOR SELECT
  USING (current_app_role() = 'owner');

-- Admin: full access
CREATE POLICY activities_admin_all
  ON activities FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

-- ============================================================
-- 5d. user_pins — scoped by user_id, not parent opp ownership
-- ============================================================

-- Rep: full CRUD on own pins
CREATE POLICY pins_rep_all
  ON user_pins FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Owner: read all
CREATE POLICY pins_owner_select
  ON user_pins FOR SELECT
  USING (current_app_role() = 'owner');

-- Admin: full access
CREATE POLICY pins_admin_all
  ON user_pins FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

-- ============================================================
-- 6. companies + contacts (shared reference data)
-- ============================================================

-- Any authenticated user: read
CREATE POLICY companies_authenticated_select
  ON companies FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin: full write access
CREATE POLICY companies_admin_all
  ON companies FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

-- Owner: write access (may need to add/update company records)
CREATE POLICY companies_owner_write
  ON companies FOR INSERT
  WITH CHECK (current_app_role() = 'owner');

CREATE POLICY companies_owner_update
  ON companies FOR UPDATE
  USING (current_app_role() = 'owner');

CREATE POLICY companies_owner_delete
  ON companies FOR DELETE
  USING (current_app_role() = 'owner');

-- Any authenticated user: read
CREATE POLICY contacts_authenticated_select
  ON contacts FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin: full write access
CREATE POLICY contacts_admin_all
  ON contacts FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

-- Owner: write access
CREATE POLICY contacts_owner_write
  ON contacts FOR INSERT
  WITH CHECK (current_app_role() = 'owner');

CREATE POLICY contacts_owner_update
  ON contacts FOR UPDATE
  USING (current_app_role() = 'owner');

CREATE POLICY contacts_owner_delete
  ON contacts FOR DELETE
  USING (current_app_role() = 'owner');
