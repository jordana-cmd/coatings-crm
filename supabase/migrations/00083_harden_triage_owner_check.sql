-- 00083_harden_triage_owner_check.sql
-- Fixes a NULL-logic hole in the ownership guard on the 00082 triage RPCs.
--
-- THE BUG: the guard was written (copying advance_stage) as
--     IF v_opp.owner_id != auth.uid() AND v_role != 'admin' THEN RAISE ...
-- When auth.uid() IS NULL, `owner_id != NULL` is NULL, so `NULL AND ...` is
-- NULL, the IF body never runs, and an unauthenticated caller sails past the
-- check into the UPDATE. Same for v_role when the caller has no user_profiles
-- row. Verified by calling close_opportunity_loss() with no JWT: it reached the
-- UPDATE instead of raising 'Permission denied'.
--
-- Reach is currently limited — EXECUTE is granted to `authenticated` only, and
-- PostgREST always presents a JWT there — but these are SECURITY DEFINER
-- functions, so the guard must hold on its own rather than rely on who can
-- reach it.
--
-- NOTE: public.advance_stage() still carries the original pattern. Left alone
-- deliberately (out of scope for this change, and it is the hot path for every
-- stage move) — worth a follow-up.

-- One place for the rule, so the three RPCs cannot drift apart.
CREATE OR REPLACE FUNCTION public.assert_opportunity_access(p_opp_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_owner uuid;
  v_role text;
BEGIN
  SELECT owner_id INTO v_owner FROM opportunities WHERE opportunities.id = p_opp_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found: %', p_opp_id; END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Permission denied: no authenticated user';
  END IF;

  v_role := (SELECT role::text FROM user_profiles WHERE user_profiles.id = auth.uid());
  IF v_owner <> auth.uid() AND coalesce(v_role, '') <> 'admin' THEN
    RAISE EXCEPTION 'Permission denied: you do not own this opportunity';
  END IF;
END; $function$;

REVOKE ALL ON FUNCTION public.assert_opportunity_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_opportunity_access(uuid) TO authenticated;

-- ── Re-declare the three triage RPCs on the shared guard ─────────────────────
-- Bodies are otherwise unchanged from 00082.

CREATE OR REPLACE FUNCTION public.close_opportunity_loss(p_opp_id uuid, p_reason text)
 RETURNS TABLE(id uuid, stage text, status opp_status)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_opp opportunities%ROWTYPE;
  v_old_stage text;
BEGIN
  PERFORM assert_opportunity_access(p_opp_id);
  SELECT * INTO v_opp FROM opportunities WHERE opportunities.id = p_opp_id;

  -- Canonical reason list. Mirrored in src/lib/lossReasons.ts — keep in sync.
  IF p_reason IS NULL OR p_reason NOT IN ('Job Cancelled', 'Other Contractor Relationship', 'Price') THEN
    RAISE EXCEPTION 'Invalid loss reason: %', COALESCE(p_reason, '(null)');
  END IF;

  IF v_opp.status = 'WON' THEN
    RAISE EXCEPTION 'Cannot close a won deal as a loss';
  END IF;

  v_old_stage := v_opp.stage;

  UPDATE opportunities SET
    stage            = 'LOST',
    status           = 'LOST',
    lost_reason      = p_reason,
    closed_loss_at   = now(),
    win_probability  = 0,
    -- Re-closing only to correct the reason must not reset the clock.
    stage_entered_at = CASE WHEN v_old_stage = 'LOST' THEN v_opp.stage_entered_at ELSE now() END,
    updated_at       = now()
  WHERE opportunities.id = p_opp_id;

  IF v_old_stage <> 'LOST' THEN
    INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_by, changed_at)
    VALUES (p_opp_id, v_old_stage, 'LOST', auth.uid(), now());
  END IF;

  RETURN QUERY SELECT opportunities.id, opportunities.stage, opportunities.status
    FROM opportunities WHERE opportunities.id = p_opp_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_opportunity_no_bid(p_opp_id uuid, p_no_bid boolean DEFAULT true)
 RETURNS TABLE(id uuid, stage text, status opp_status)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_opp opportunities%ROWTYPE;
BEGIN
  PERFORM assert_opportunity_access(p_opp_id);
  SELECT * INTO v_opp FROM opportunities WHERE opportunities.id = p_opp_id;

  IF v_opp.status IN ('WON', 'LOST') THEN
    RAISE EXCEPTION 'Deal is already closed (%) — reopen it before changing the bid decision', v_opp.status;
  END IF;

  IF p_no_bid THEN
    UPDATE opportunities SET status = 'NO_BID', win_probability = 0, updated_at = now()
      WHERE opportunities.id = p_opp_id;
    UPDATE bids SET go_no_go = false WHERE bids.opportunity_id = p_opp_id;
  ELSE
    UPDATE opportunities SET status = 'OPEN', updated_at = now()
      WHERE opportunities.id = p_opp_id AND opportunities.status = 'NO_BID';
  END IF;

  RETURN QUERY SELECT opportunities.id, opportunities.stage, opportunities.status
    FROM opportunities WHERE opportunities.id = p_opp_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.affirm_bid(p_opp_id uuid)
 RETURNS TABLE(id uuid, stage text, status opp_status)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_opp opportunities%ROWTYPE;
BEGIN
  PERFORM assert_opportunity_access(p_opp_id);
  SELECT * INTO v_opp FROM opportunities WHERE opportunities.id = p_opp_id;

  IF v_opp.status IN ('WON', 'LOST') THEN
    RAISE EXCEPTION 'Deal is already closed (%) — reopen it before changing the bid decision', v_opp.status;
  END IF;

  UPDATE opportunities SET
    status     = CASE WHEN v_opp.status = 'NO_BID' THEN 'OPEN'::opp_status ELSE v_opp.status END,
    updated_at = now()
  WHERE opportunities.id = p_opp_id;

  UPDATE bids SET go_no_go = true WHERE bids.opportunity_id = p_opp_id;

  RETURN QUERY SELECT opportunities.id, opportunities.stage, opportunities.status
    FROM opportunities WHERE opportunities.id = p_opp_id;
END; $function$;

GRANT EXECUTE ON FUNCTION public.close_opportunity_loss(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_opportunity_no_bid(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affirm_bid(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run manually; forward-only repo).
-- Restore the three function bodies from 00082, then:
--   DROP FUNCTION IF EXISTS public.assert_opportunity_access(uuid);
-- ─────────────────────────────────────────────────────────────────────────────
