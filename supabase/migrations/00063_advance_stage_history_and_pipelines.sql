-- 00063_advance_stage_history_and_pipelines.sql
-- Fixes two regressions/gaps in advance_stage():
-- 1. 00058 rewrote advance_stage() off a pre-00029 copy, silently dropping the
--    opportunity_stage_history INSERT. Restored here.
-- 2. GC_CHASE/FACILITY unconditionally RAISE EXCEPTION on any advance attempt.
--    Minimal patch: implement their active/terminal stage arrays (mirroring
--    src/lib/pipelines.ts GC_CHASE_ACTIVE/FACILITY_ACTIVE) with no extra
--    business-rule gates yet (PUBLIC_BID keeps its existing gate checks).
-- Also fixes status coupling: WON/NURTURE stage transitions on GC_CHASE/FACILITY
-- previously left status stuck at OPEN (only PUBLIC_BID+AWARDED and any-pipeline
-- LOST were handled).

CREATE OR REPLACE FUNCTION advance_stage(
  p_opp_id       uuid,
  p_target_stage text
)
RETURNS TABLE(id uuid, stage text, status opp_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp   opportunities%ROWTYPE;
  v_bids  bids%ROWTYPE;
  v_role  text;
  v_unmet text[] := '{}';
  v_new_status opp_status;
  v_active text[];
  v_cur_idx int;
  v_tgt_idx int;
  v_terminals text[];
  v_win_prob numeric;
  v_old_stage text;
BEGIN
  SELECT * INTO v_opp FROM opportunities WHERE opportunities.id = p_opp_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found: %', p_opp_id;
  END IF;

  v_role := (SELECT role::text FROM user_profiles WHERE user_profiles.id = auth.uid());
  IF v_opp.owner_id != auth.uid() AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Permission denied: you do not own this opportunity';
  END IF;

  CASE v_opp.pipeline
    WHEN 'PUBLIC_BID' THEN
      v_active := ARRAY['SOURCED','ESTIMATING','SUBMITTED','AWARDED'];
      v_terminals := CASE v_opp.stage WHEN 'SUBMITTED' THEN ARRAY['AWARDED','LOST'] ELSE '{}'::text[] END;
    WHEN 'GC_CHASE' THEN
      v_active := ARRAY['ON_THE_LIST','QUOTING','CARRIED','GC_AWARDED','WON'];
      v_terminals := CASE v_opp.stage WHEN 'GC_AWARDED' THEN ARRAY['LOST'] ELSE '{}'::text[] END;
    WHEN 'FACILITY' THEN
      v_active := ARRAY['ENGAGED','SITE_WALK','PROPOSAL','APPROVAL','WON'];
      v_terminals := CASE v_opp.stage WHEN 'APPROVAL' THEN ARRAY['LOST','NURTURE'] ELSE '{}'::text[] END;
  END CASE;

  v_cur_idx := array_position(v_active, v_opp.stage);
  v_tgt_idx := array_position(v_active, p_target_stage);

  IF v_cur_idx IS NULL THEN
    RAISE EXCEPTION 'Cannot advance from terminal stage %', v_opp.stage;
  END IF;

  IF NOT (
    (v_tgt_idx IS NOT NULL AND v_tgt_idx = v_cur_idx + 1)
    OR (p_target_stage = ANY(v_terminals))
  ) THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', v_opp.stage, p_target_stage;
  END IF;

  SELECT * INTO v_bids FROM bids WHERE bids.opportunity_id = p_opp_id;

  IF v_opp.pipeline = 'PUBLIC_BID' THEN

    IF v_opp.stage = 'SOURCED' AND p_target_stage = 'ESTIMATING' THEN
      IF v_bids.plans_link IS NULL THEN
        v_unmet := array_append(v_unmet, 'Plans link uploaded');
      END IF;

    ELSIF v_opp.stage = 'ESTIMATING' AND p_target_stage = 'SUBMITTED' THEN
      IF NOT v_bids.addenda_acknowledged THEN
        v_unmet := array_append(v_unmet, 'Addenda acknowledged');
      END IF;
      IF v_opp.amount IS NULL THEN
        v_unmet := array_append(v_unmet, 'Bid amount entered');
      END IF;
      IF v_bids.prebid_walk_mandatory AND NOT v_bids.prebid_walk_completed THEN
        v_unmet := array_append(v_unmet, 'Mandatory pre-bid walk completed');
      END IF;
      IF v_bids.bond_required AND NOT v_bids.bond_arranged THEN
        v_unmet := array_append(v_unmet, 'Bond arranged');
      END IF;
      IF v_bids.estimate_file_url IS NULL THEN
        v_unmet := array_append(v_unmet, 'Estimate file uploaded');
      END IF;

    ELSIF v_opp.stage = 'SUBMITTED' AND p_target_stage IN ('AWARDED', 'LOST') THEN
      IF v_bids.bid_due_at IS NULL OR v_bids.bid_due_at > now() THEN
        v_unmet := array_append(v_unmet, 'Bid due date has passed');
      END IF;
      -- GP gate: required for AWARDED (close-won), not for LOST
      IF p_target_stage = 'AWARDED' AND (v_opp.gross_profit_pct IS NULL OR v_opp.gross_profit_pct <= 0) THEN
        v_unmet := array_append(v_unmet, 'Gross profit % recorded');
      END IF;
    END IF;

  END IF;

  IF array_length(v_unmet, 1) > 0 THEN
    RAISE EXCEPTION 'Gate blocked: %', array_to_string(v_unmet, '; ');
  END IF;

  IF v_opp.pipeline = 'PUBLIC_BID' AND p_target_stage = 'AWARDED' THEN
    v_new_status := 'WON';
  ELSIF p_target_stage = 'WON' THEN
    v_new_status := 'WON';
  ELSIF p_target_stage = 'LOST' THEN
    v_new_status := 'LOST';
  ELSIF p_target_stage = 'NURTURE' THEN
    v_new_status := 'NURTURE';
  ELSE
    v_new_status := v_opp.status;
  END IF;

  v_win_prob := CASE v_opp.pipeline
    WHEN 'PUBLIC_BID' THEN CASE p_target_stage
      WHEN 'SOURCED' THEN 10 WHEN 'ESTIMATING' THEN 25 WHEN 'SUBMITTED' THEN 40
      WHEN 'AWARDED' THEN 100 WHEN 'LOST' THEN 0 ELSE NULL END
    WHEN 'GC_CHASE' THEN CASE p_target_stage
      WHEN 'ON_THE_LIST' THEN 10 WHEN 'QUOTING' THEN 25 WHEN 'CARRIED' THEN 40
      WHEN 'GC_AWARDED' THEN 70 WHEN 'WON' THEN 100 WHEN 'LOST' THEN 0 ELSE NULL END
    WHEN 'FACILITY' THEN CASE p_target_stage
      WHEN 'ENGAGED' THEN 15 WHEN 'SITE_WALK' THEN 35 WHEN 'PROPOSAL' THEN 55
      WHEN 'APPROVAL' THEN 75 WHEN 'WON' THEN 100 WHEN 'LOST' THEN 0 WHEN 'NURTURE' THEN 0 ELSE NULL END
    ELSE NULL
  END;

  -- Save old stage for history
  v_old_stage := v_opp.stage;

  UPDATE opportunities
     SET stage = p_target_stage,
         status = v_new_status,
         updated_at = now(),
         stage_entered_at = now(),
         win_probability = v_win_prob
   WHERE opportunities.id = p_opp_id;

  -- Record stage transition history
  INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_by, changed_at)
  VALUES (p_opp_id, v_old_stage, p_target_stage, auth.uid(), now());

  RETURN QUERY
    SELECT opportunities.id, opportunities.stage, opportunities.status
      FROM opportunities
     WHERE opportunities.id = p_opp_id;
END;
$$;
