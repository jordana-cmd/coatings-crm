-- 00084_advance_stage_core.sql
-- STEP 1 OF 2 (additive, no behaviour change to advance_stage yet).
--
-- Prepares the same NULL-guard fix 00083 applied to the triage RPCs for
-- advance_stage(), which still carries the original pattern:
--     IF v_opp.owner_id != auth.uid() AND v_role != 'admin' THEN RAISE ...
-- With auth.uid() NULL that is `NULL AND ...` → NULL, so the RAISE never fires.
--
-- WHY THIS CANNOT BE A ONE-LINE FIX: supabase/functions/cowork-write calls
-- advance_stage with the SERVICE-ROLE key and no user JWT, so auth.uid() is
-- NULL there. That call passes the ownership check *today only because of the
-- hole*. Hardening advance_stage on its own would break the Cowork agent's
-- advance_stage action in production.
--
-- So we follow the pattern 00079 already set for the other two Cowork actions
-- (cowork_create_opportunity / cowork_log_activity): extract an explicit-actor
-- core, then front it with one auth.uid() wrapper for the app and one p_owner
-- wrapper for the service-role caller.
--
-- Sequencing (zero downtime):
--   00084 (this file) — add the core + cowork_advance_stage. advance_stage
--                       keeps its current body, so nothing changes yet.
--   deploy cowork-write — switch it to cowork_advance_stage.
--   00085             — repoint advance_stage at the hardened core.
--
-- SIDE BENEFIT: opportunity_stage_history.changed_by is currently NULL for
-- every Cowork-driven advance (it passes auth.uid()). Routing through p_owner
-- attributes those rows to COWORK_WRITE_OWNER_ID, matching cowork_log_activity.

-- ── One definition of the access rule, actor passed in ───────────────────────

CREATE OR REPLACE FUNCTION public.assert_opportunity_access_for(p_actor uuid, p_opp_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_owner uuid;
  v_role text;
BEGIN
  SELECT owner_id INTO v_owner FROM opportunities WHERE opportunities.id = p_opp_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found: %', p_opp_id; END IF;

  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'Permission denied: no authenticated user';
  END IF;

  v_role := (SELECT role::text FROM user_profiles WHERE user_profiles.id = p_actor);
  IF v_owner <> p_actor AND coalesce(v_role, '') <> 'admin' THEN
    RAISE EXCEPTION 'Permission denied: you do not own this opportunity';
  END IF;
END; $function$;

-- 00083's version now delegates, so there is a single copy of the rule.
CREATE OR REPLACE FUNCTION public.assert_opportunity_access(p_opp_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM assert_opportunity_access_for(auth.uid(), p_opp_id);
END; $function$;

-- ── advance_stage_core — body identical to the live 00076 function, with
--    auth.uid() replaced by p_actor (guard, role lookup, and changed_by) ──────

CREATE OR REPLACE FUNCTION public.advance_stage_core(p_actor uuid, p_opp_id uuid, p_target_stage text)
 RETURNS TABLE(id uuid, stage text, status opp_status)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_opp opportunities%ROWTYPE; v_bids bids%ROWTYPE; v_fed federal_details%ROWTYPE;
  v_unmet text[] := '{}'; v_new_status opp_status;
  v_active text[]; v_cur_idx int; v_tgt_idx int; v_terminals text[];
  v_win_prob numeric; v_old_stage text;
BEGIN
  SELECT * INTO v_opp FROM opportunities WHERE opportunities.id = p_opp_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found: %', p_opp_id; END IF;

  PERFORM assert_opportunity_access_for(p_actor, p_opp_id);

  CASE v_opp.pipeline
    WHEN 'PUBLIC_BID' THEN
      v_active := ARRAY['SOURCED','BIDDING','ESTIMATED','SUBMITTED','AWARDED'];
      v_terminals := CASE v_opp.stage WHEN 'SUBMITTED' THEN ARRAY['AWARDED','LOST'] ELSE '{}'::text[] END;
    WHEN 'GC_CHASE' THEN
      v_active := ARRAY['QUALIFIED','BIDDING','ESTIMATED','SUBMITTED','GC_AWARDED','WON'];
      v_terminals := CASE v_opp.stage WHEN 'GC_AWARDED' THEN ARRAY['LOST'] ELSE '{}'::text[] END;
    WHEN 'FACILITY' THEN
      v_active := ARRAY['ENGAGED','SITE_WALK','PROPOSAL','APPROVAL','WON'];
      v_terminals := CASE v_opp.stage WHEN 'APPROVAL' THEN ARRAY['LOST'] ELSE '{}'::text[] END;
    WHEN 'FEDERAL' THEN
      v_active := ARRAY['INTAKE','EXTRACTION','SCORING','ESTIMATING','SUBMITTED','AWARDED'];
      v_terminals := CASE v_opp.stage WHEN 'SUBMITTED' THEN ARRAY['AWARDED','LOST'] ELSE '{}'::text[] END;
  END CASE;

  v_cur_idx := array_position(v_active, v_opp.stage);
  v_tgt_idx := array_position(v_active, p_target_stage);
  IF v_cur_idx IS NULL THEN RAISE EXCEPTION 'Cannot advance from terminal stage %', v_opp.stage; END IF;
  IF NOT ((v_tgt_idx IS NOT NULL AND v_tgt_idx = v_cur_idx + 1) OR (p_target_stage = ANY(v_terminals))) THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', v_opp.stage, p_target_stage;
  END IF;

  -- Gate checks. New BIDDING transitions are permissive; strict checks stay at ESTIMATED→SUBMITTED.
  IF v_opp.pipeline = 'PUBLIC_BID' THEN
    SELECT * INTO v_bids FROM bids WHERE bids.opportunity_id = p_opp_id;
    IF v_opp.stage = 'SOURCED' AND p_target_stage = 'BIDDING' THEN
      IF v_bids.plans_link IS NULL THEN v_unmet := array_append(v_unmet, 'Plans link uploaded'); END IF;
    ELSIF v_opp.stage = 'ESTIMATED' AND p_target_stage = 'SUBMITTED' THEN
      IF NOT v_bids.addenda_acknowledged THEN v_unmet := array_append(v_unmet, 'Addenda acknowledged'); END IF;
      IF v_opp.amount IS NULL THEN v_unmet := array_append(v_unmet, 'Bid amount entered'); END IF;
      IF v_bids.prebid_walk_mandatory AND NOT v_bids.prebid_walk_completed THEN
        v_unmet := array_append(v_unmet, 'Mandatory pre-bid walk completed'); END IF;
      IF v_bids.bond_required AND NOT v_bids.bond_arranged THEN
        v_unmet := array_append(v_unmet, 'Bond arranged'); END IF;
      IF v_bids.estimate_file_url IS NULL THEN v_unmet := array_append(v_unmet, 'Estimate file uploaded'); END IF;
    ELSIF v_opp.stage = 'SUBMITTED' AND p_target_stage IN ('AWARDED','LOST') THEN
      IF v_bids.bid_due_at IS NULL OR v_bids.bid_due_at > now() THEN
        v_unmet := array_append(v_unmet, 'Bid due date has passed'); END IF;
      IF p_target_stage = 'AWARDED' AND (v_opp.gross_profit_pct IS NULL OR v_opp.gross_profit_pct <= 0) THEN
        v_unmet := array_append(v_unmet, 'Gross profit % recorded'); END IF;
    END IF;

  ELSIF v_opp.pipeline = 'FEDERAL' THEN
    SELECT * INTO v_fed FROM federal_details WHERE federal_details.opportunity_id = p_opp_id;
    IF v_opp.stage = 'INTAKE' AND p_target_stage = 'EXTRACTION' THEN
      IF v_fed.extraction_status != 'COMPLETE' THEN v_unmet := array_append(v_unmet, 'Document extraction completed'); END IF;
    ELSIF v_opp.stage = 'EXTRACTION' AND p_target_stage = 'SCORING' THEN
      IF v_fed.scoring_status != 'COMPLETE' THEN v_unmet := array_append(v_unmet, 'Opportunity scoring completed'); END IF;
    ELSIF v_opp.stage = 'SCORING' AND p_target_stage = 'ESTIMATING' THEN
      IF v_fed.score_recommendation IS NULL THEN v_unmet := array_append(v_unmet, 'Score recommendation reviewed'); END IF;
    ELSIF v_opp.stage = 'ESTIMATING' AND p_target_stage = 'SUBMITTED' THEN
      IF v_fed.estimate_total IS NULL THEN v_unmet := array_append(v_unmet, 'Estimate total calculated'); END IF;
      IF v_fed.bid_package_url IS NULL THEN v_unmet := array_append(v_unmet, 'Bid package assembled'); END IF;
    ELSIF v_opp.stage = 'SUBMITTED' AND p_target_stage IN ('AWARDED','LOST') THEN
      IF v_fed.response_deadline IS NULL OR v_fed.response_deadline > now() THEN
        v_unmet := array_append(v_unmet, 'Response deadline has passed'); END IF;
      IF p_target_stage = 'AWARDED' AND (v_opp.gross_profit_pct IS NULL OR v_opp.gross_profit_pct <= 0) THEN
        v_unmet := array_append(v_unmet, 'Gross profit % recorded'); END IF;
    END IF;
  END IF;

  IF array_length(v_unmet, 1) > 0 THEN
    RAISE EXCEPTION 'Gate blocked: %', array_to_string(v_unmet, '; ');
  END IF;

  -- Status coupling (NURTURE removed with the Facility stage).
  IF (v_opp.pipeline = 'PUBLIC_BID' OR v_opp.pipeline = 'FEDERAL') AND p_target_stage = 'AWARDED' THEN
    v_new_status := 'WON';
  ELSIF p_target_stage = 'WON' THEN v_new_status := 'WON';
  ELSIF p_target_stage = 'LOST' THEN v_new_status := 'LOST';
  ELSE v_new_status := v_opp.status;
  END IF;

  v_win_prob := CASE v_opp.pipeline
    WHEN 'PUBLIC_BID' THEN CASE p_target_stage
      WHEN 'SOURCED' THEN 10 WHEN 'BIDDING' THEN 25 WHEN 'ESTIMATED' THEN 45 WHEN 'SUBMITTED' THEN 65
      WHEN 'AWARDED' THEN 100 WHEN 'LOST' THEN 0 ELSE NULL END
    WHEN 'GC_CHASE' THEN CASE p_target_stage
      WHEN 'QUALIFIED' THEN 10 WHEN 'BIDDING' THEN 25 WHEN 'ESTIMATED' THEN 40 WHEN 'SUBMITTED' THEN 55
      WHEN 'GC_AWARDED' THEN 70 WHEN 'WON' THEN 100 WHEN 'LOST' THEN 0 ELSE NULL END
    WHEN 'FACILITY' THEN CASE p_target_stage
      WHEN 'ENGAGED' THEN 15 WHEN 'SITE_WALK' THEN 35 WHEN 'PROPOSAL' THEN 55
      WHEN 'APPROVAL' THEN 75 WHEN 'WON' THEN 100 WHEN 'LOST' THEN 0 ELSE NULL END
    WHEN 'FEDERAL' THEN CASE p_target_stage
      WHEN 'INTAKE' THEN 5 WHEN 'EXTRACTION' THEN 10 WHEN 'SCORING' THEN 20
      WHEN 'ESTIMATING' THEN 35 WHEN 'SUBMITTED' THEN 50 WHEN 'AWARDED' THEN 100 WHEN 'LOST' THEN 0 ELSE NULL END
    ELSE NULL END;

  v_old_stage := v_opp.stage;
  UPDATE opportunities SET stage = p_target_stage, status = v_new_status, updated_at = now(),
         stage_entered_at = now(), win_probability = v_win_prob WHERE opportunities.id = p_opp_id;
  INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_by, changed_at)
  VALUES (p_opp_id, v_old_stage, p_target_stage, p_actor, now());

  RETURN QUERY SELECT opportunities.id, opportunities.stage, opportunities.status
    FROM opportunities WHERE opportunities.id = p_opp_id;
END; $function$;

-- ── Service-role front door (mirrors cowork_create_opportunity / _log_activity) ──

CREATE OR REPLACE FUNCTION public.cowork_advance_stage(p_owner uuid, p_opp_id uuid, p_target_stage text)
 RETURNS TABLE(id uuid, stage text, status opp_status)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF p_owner IS NULL THEN RAISE EXCEPTION 'p_owner is required'; END IF;
  RETURN QUERY SELECT * FROM advance_stage_core(p_owner, p_opp_id, p_target_stage);
END; $function$;

-- ── Grants ───────────────────────────────────────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC by default. Both of these take an actor as
-- a parameter, so leaving them reachable by `authenticated` would let any
-- logged-in user act as any owner. Revoke first, then grant narrowly.
-- The wrappers are SECURITY DEFINER, so they can still reach the core.

REVOKE ALL ON FUNCTION public.assert_opportunity_access_for(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_stage_core(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cowork_advance_stage(uuid, uuid, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.assert_opportunity_access_for(uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_stage_core(uuid, uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.cowork_advance_stage(uuid, uuid, text) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cowork_advance_stage(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_opportunity_access(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run manually; forward-only repo).
-- ─────────────────────────────────────────────────────────────────────────────
-- Nothing here changes existing behaviour, so rolling back is just removal —
-- but only AFTER 00085 has been rolled back, since it depends on the core:
--   DROP FUNCTION IF EXISTS public.cowork_advance_stage(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.advance_stage_core(uuid, uuid, text);
--   -- restore 00083's inline body of assert_opportunity_access(uuid), then:
--   DROP FUNCTION IF EXISTS public.assert_opportunity_access_for(uuid, uuid);
