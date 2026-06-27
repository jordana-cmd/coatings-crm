-- 00050_job_completion.sql
-- Job-completion write path for won opportunities.
-- Columns completed_at (date), completion_notes (text), final_value (numeric)
-- already exist (00018) with CHECK chk_completion_requires_won.
-- This migration adds:
--   1. UPDATE grants so authenticated users can write the completion columns
--   2. mark_complete() RPC — sets completed_at + final_value (+ optional notes)
--   3. undo_complete() RPC — clears all three completion columns
-- Both RPCs are SECURITY DEFINER to bypass column-level grant complexity,
-- with ownership/admin guard matching advance_stage pattern.

-- ============================================================
-- 1. Column-level UPDATE grants
-- ============================================================
GRANT UPDATE (completed_at, completion_notes, final_value)
  ON opportunities TO authenticated;

-- ============================================================
-- 2. mark_complete(opp_id, final_value, completed_at?, notes?)
-- ============================================================
CREATE OR REPLACE FUNCTION mark_complete(
  p_opp_id        uuid,
  p_final_value    numeric,
  p_completed_at   date DEFAULT CURRENT_DATE,
  p_notes          text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp   opportunities%ROWTYPE;
  v_role  text;
BEGIN
  SELECT * INTO v_opp FROM opportunities WHERE id = p_opp_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found: %', p_opp_id;
  END IF;

  -- Ownership / admin guard
  v_role := (SELECT role::text FROM user_profiles WHERE user_profiles.id = auth.uid());
  IF v_opp.owner_id != auth.uid() AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Permission denied: you do not own this opportunity';
  END IF;

  -- Must be WON
  IF v_opp.status != 'WON' THEN
    RAISE EXCEPTION 'Cannot mark complete: opportunity status is %, must be WON', v_opp.status;
  END IF;

  UPDATE opportunities
     SET completed_at = p_completed_at,
         final_value  = p_final_value,
         completion_notes = p_notes,
         updated_at   = now()
   WHERE id = p_opp_id;
END;
$$;

-- ============================================================
-- 3. undo_complete(opp_id)
-- ============================================================
CREATE OR REPLACE FUNCTION undo_complete(
  p_opp_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp   opportunities%ROWTYPE;
  v_role  text;
BEGIN
  SELECT * INTO v_opp FROM opportunities WHERE id = p_opp_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found: %', p_opp_id;
  END IF;

  v_role := (SELECT role::text FROM user_profiles WHERE user_profiles.id = auth.uid());
  IF v_opp.owner_id != auth.uid() AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Permission denied: you do not own this opportunity';
  END IF;

  UPDATE opportunities
     SET completed_at = NULL,
         final_value  = NULL,
         completion_notes = NULL,
         updated_at   = now()
   WHERE id = p_opp_id;
END;
$$;
