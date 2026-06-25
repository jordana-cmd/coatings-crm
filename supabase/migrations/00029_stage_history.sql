-- 00029_stage_history.sql
-- Stage history table + recording on advance/create + backfill.
-- Gate logic is UNCHANGED — only history recording is added.

CREATE TABLE opportunity_stage_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  from_stage      text,
  to_stage        text        NOT NULL,
  changed_by      uuid        REFERENCES auth.users(id),
  changed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stage_history_opp ON opportunity_stage_history (opportunity_id, changed_at);
CREATE INDEX idx_stage_history_to ON opportunity_stage_history (to_stage, changed_at);

-- RLS: derive from parent opportunity
ALTER TABLE opportunity_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY stage_history_rep_select
  ON opportunity_stage_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM opportunities WHERE opportunities.id = opportunity_stage_history.opportunity_id
      AND opportunities.owner_id = auth.uid()
  ));

CREATE POLICY stage_history_owner_select
  ON opportunity_stage_history FOR SELECT
  USING (current_app_role() = 'owner');

CREATE POLICY stage_history_admin_all
  ON opportunity_stage_history FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

-- Insert is done by SECURITY DEFINER RPCs, but grant anyway for completeness
GRANT SELECT, INSERT ON opportunity_stage_history TO authenticated;

-- ============================================================
-- Backfill: initial history row for every existing opp
-- ============================================================
INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_by, changed_at)
SELECT id, NULL, stage, owner_id, COALESCE(stage_entered_at, created_at)
FROM opportunities;

-- ============================================================
-- Update advance_stage: add history INSERT after the stage UPDATE.
-- Gate logic is BYTE-FOR-BYTE identical to 00023.
-- ============================================================
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

-- ============================================================
-- Update create_opportunity: record initial stage in history.
-- ============================================================
CREATE OR REPLACE FUNCTION create_opportunity(
  p_name           text,
  p_pipeline       pipeline_type,
  p_company_id     uuid,
  p_job_site_address text,
  p_amount         numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_opp_id uuid;
  v_stage  text;
BEGIN
  v_stage := CASE p_pipeline
    WHEN 'PUBLIC_BID' THEN 'SOURCED'
    WHEN 'GC_CHASE'   THEN 'ON_THE_LIST'
    WHEN 'FACILITY'   THEN 'ENGAGED'
  END;

  INSERT INTO opportunities (name, pipeline, stage, status, owner_id, company_id, job_site_address, amount)
  VALUES (p_name, p_pipeline, v_stage, 'OPEN', auth.uid(), p_company_id, p_job_site_address, p_amount)
  RETURNING id INTO v_opp_id;

  IF p_pipeline IN ('PUBLIC_BID', 'GC_CHASE') THEN
    INSERT INTO bids (opportunity_id) VALUES (v_opp_id);
  ELSE
    INSERT INTO facility_details (opportunity_id) VALUES (v_opp_id);
  END IF;

  -- Record initial stage in history
  INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_by, changed_at)
  VALUES (v_opp_id, NULL, v_stage, auth.uid(), now());

  RETURN v_opp_id;
END;
$$;
