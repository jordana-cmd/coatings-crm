-- 00058_opportunity_gross_profit.sql
-- Add gross_profit_pct to opportunities + gate it before close-won.
-- GP dollars = amount * gross_profit_pct / 100 (derived, not stored).

-- 1. Add column
ALTER TABLE opportunities
  ADD COLUMN gross_profit_pct numeric;

-- 2. Grant UPDATE to authenticated users (column-level grants are additive)
GRANT UPDATE (gross_profit_pct) ON opportunities TO authenticated;

-- 3. Update advance_stage RPC to gate GP on winning transitions.
-- Gate logic changes: add gross_profit_pct check before AWARDED (PUBLIC_BID).
-- GC_CHASE and FACILITY not yet implemented in the RPC — when they are, add the same gate.
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
      RAISE EXCEPTION 'GC_CHASE pipeline advance not yet implemented';
    WHEN 'FACILITY' THEN
      RAISE EXCEPTION 'FACILITY pipeline advance not yet implemented';
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
  ELSIF p_target_stage = 'LOST' THEN
    v_new_status := 'LOST';
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

  UPDATE opportunities
     SET stage = p_target_stage,
         status = v_new_status,
         updated_at = now(),
         stage_entered_at = now(),
         win_probability = v_win_prob
   WHERE opportunities.id = p_opp_id;

  RETURN QUERY
    SELECT opportunities.id, opportunities.stage, opportunities.status
      FROM opportunities
     WHERE opportunities.id = p_opp_id;
END;
$$;
