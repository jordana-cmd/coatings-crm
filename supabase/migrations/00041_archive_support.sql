-- 00041_archive_support.sql
-- Part A: soft-archive for companies + contacts (archived_at timestamptz).
-- Part B: delete_opportunity RPC with ownership check (hard delete; CASCADE handles children).

-- ============================================================
-- Part A: Archive columns
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_companies_active ON companies (id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_active ON contacts (id) WHERE archived_at IS NULL;

-- ============================================================
-- Part B: delete_opportunity RPC
-- SECURITY DEFINER so it can delete the stage-locked opp.
-- Checks ownership (owner_id = auth.uid()) or admin.
-- Child rows (bids, bid_quotes, activities, opportunity_stage_history)
-- are removed automatically by ON DELETE CASCADE FKs.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_opportunity(p_opp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp opportunities%ROWTYPE;
  v_role text;
BEGIN
  SELECT * INTO v_opp FROM opportunities WHERE id = p_opp_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found: %', p_opp_id;
  END IF;

  v_role := (SELECT role::text FROM user_profiles WHERE user_profiles.id = auth.uid());
  IF v_opp.owner_id != auth.uid() AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Permission denied: you do not own this opportunity';
  END IF;

  -- Hard delete — CASCADE removes bids, bid_quotes, activities, stage_history
  DELETE FROM opportunities WHERE id = p_opp_id;
END;
$$;
