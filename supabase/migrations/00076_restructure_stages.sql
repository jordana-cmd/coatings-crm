-- 00076_restructure_stages.sql
-- Stage model restructure. Stages are TEXT validated by chk_stage_in_pipeline →
-- valid_stage_for_pipeline(); no enum, so: drop constraint → UPDATE rows →
-- replace function → re-add constraint, all in the migration's transaction.
--
-- Target model:
--   PUBLIC_BID: SOURCED, BIDDING(new), ESTIMATED(rename of ESTIMATING), SUBMITTED, AWARDED, LOST
--   GC_CHASE:   QUALIFIED(rename of ON_THE_LIST), BIDDING(new), ESTIMATED(new), SUBMITTED(new),
--               GC_AWARDED, WON, LOST   [QUOTING & CARRIED removed]
--   FACILITY:   ENGAGED, SITE_WALK, PROPOSAL, APPROVAL, WON, LOST   [NURTURE stage removed]
--   FEDERAL:    UNCHANGED (keeps its own ESTIMATING — rename is PUBLIC_BID-scoped)
--
-- Rollback is at the bottom (repo migrations are forward-only).

-- 1. Drop the CHECK so interim states are legal during the UPDATEs.
ALTER TABLE opportunities DROP CONSTRAINT chk_stage_in_pipeline;

-- 2. Move rows (pipeline-scoped so FEDERAL's ESTIMATING is untouched).
UPDATE opportunities SET stage = 'ESTIMATED'  WHERE pipeline = 'PUBLIC_BID' AND stage = 'ESTIMATING';
UPDATE opportunities SET stage = 'QUALIFIED'  WHERE pipeline = 'GC_CHASE'   AND stage = 'ON_THE_LIST';
-- QUOTING → SUBMITTED: the 3 PlanHub deals (already bid to the GC). Semantic move, pinned in rollback.
UPDATE opportunities SET stage = 'SUBMITTED'  WHERE pipeline = 'GC_CHASE'   AND stage = 'QUOTING';

-- 3. Stage history: rewrite PURE RENAMES only (preserve KPI continuity).
--    Do NOT touch QUOTING→SUBMITTED rows — that reclassification stays honest in the audit trail.
UPDATE opportunity_stage_history h SET from_stage = 'ESTIMATED'
  FROM opportunities o WHERE h.opportunity_id = o.id AND o.pipeline = 'PUBLIC_BID' AND h.from_stage = 'ESTIMATING';
UPDATE opportunity_stage_history h SET to_stage = 'ESTIMATED'
  FROM opportunities o WHERE h.opportunity_id = o.id AND o.pipeline = 'PUBLIC_BID' AND h.to_stage = 'ESTIMATING';
UPDATE opportunity_stage_history h SET from_stage = 'QUALIFIED'
  FROM opportunities o WHERE h.opportunity_id = o.id AND o.pipeline = 'GC_CHASE' AND h.from_stage = 'ON_THE_LIST';
UPDATE opportunity_stage_history h SET to_stage = 'QUALIFIED'
  FROM opportunities o WHERE h.opportunity_id = o.id AND o.pipeline = 'GC_CHASE' AND h.to_stage = 'ON_THE_LIST';

-- 4. New per-pipeline valid stage sets.
CREATE OR REPLACE FUNCTION public.valid_stage_for_pipeline(p pipeline_type, s text)
 RETURNS boolean LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE p
    WHEN 'PUBLIC_BID' THEN s IN ('SOURCED','BIDDING','ESTIMATED','SUBMITTED','AWARDED','LOST')
    WHEN 'GC_CHASE'   THEN s IN ('QUALIFIED','BIDDING','ESTIMATED','SUBMITTED','GC_AWARDED','WON','LOST')
    WHEN 'FACILITY'   THEN s IN ('ENGAGED','SITE_WALK','PROPOSAL','APPROVAL','WON','LOST')
    WHEN 'FEDERAL'    THEN s IN ('INTAKE','EXTRACTION','SCORING','ESTIMATING','SUBMITTED','AWARDED','LOST')
    ELSE false
  END;
$function$;

-- 5. Re-add the CHECK.
ALTER TABLE opportunities
  ADD CONSTRAINT chk_stage_in_pipeline CHECK (valid_stage_for_pipeline(pipeline, stage));

-- 6. create_opportunity: GC_CHASE entry → QUALIFIED.
CREATE OR REPLACE FUNCTION public.create_opportunity(p_name text, p_pipeline pipeline_type, p_company_id uuid, p_job_site_address text, p_amount numeric DEFAULT NULL::numeric)
 RETURNS uuid LANGUAGE plpgsql AS $function$
DECLARE v_opp_id uuid; v_stage text;
BEGIN
  v_stage := CASE p_pipeline
    WHEN 'PUBLIC_BID' THEN 'SOURCED'
    WHEN 'GC_CHASE'   THEN 'QUALIFIED'
    WHEN 'FACILITY'   THEN 'ENGAGED'
    WHEN 'FEDERAL'    THEN 'INTAKE'
  END;
  INSERT INTO opportunities (name, pipeline, stage, status, owner_id, company_id, job_site_address, amount)
  VALUES (p_name, p_pipeline, v_stage, 'OPEN', auth.uid(), p_company_id, p_job_site_address, p_amount)
  RETURNING id INTO v_opp_id;
  IF p_pipeline IN ('PUBLIC_BID','GC_CHASE') THEN
    INSERT INTO bids (opportunity_id) VALUES (v_opp_id);
  ELSIF p_pipeline = 'FACILITY' THEN
    INSERT INTO facility_details (opportunity_id) VALUES (v_opp_id);
  ELSIF p_pipeline = 'FEDERAL' THEN
    INSERT INTO federal_details (opportunity_id) VALUES (v_opp_id);
  END IF;
  RETURN v_opp_id;
END; $function$;

-- 7. advance_stage: new active chains, terminals, gate checks, win-probability.
CREATE OR REPLACE FUNCTION public.advance_stage(p_opp_id uuid, p_target_stage text)
 RETURNS TABLE(id uuid, stage text, status opp_status)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_opp opportunities%ROWTYPE; v_bids bids%ROWTYPE; v_fed federal_details%ROWTYPE;
  v_role text; v_unmet text[] := '{}'; v_new_status opp_status;
  v_active text[]; v_cur_idx int; v_tgt_idx int; v_terminals text[];
  v_win_prob numeric; v_old_stage text;
BEGIN
  SELECT * INTO v_opp FROM opportunities WHERE opportunities.id = p_opp_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found: %', p_opp_id; END IF;

  v_role := (SELECT role::text FROM user_profiles WHERE user_profiles.id = auth.uid());
  IF v_opp.owner_id != auth.uid() AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Permission denied: you do not own this opportunity';
  END IF;

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
  VALUES (p_opp_id, v_old_stage, p_target_stage, auth.uid(), now());

  RETURN QUERY SELECT opportunities.id, opportunities.stage, opportunities.status
    FROM opportunities WHERE opportunities.id = p_opp_id;
END; $function$;

-- 8. Views off the removed CARRIED stage → new active-bid sets (Outstanding Bid starts at BIDDING).
CREATE OR REPLACE VIEW v_outstanding_bid_dollars AS
  SELECT pipeline, COALESCE(sum(amount), 0::numeric) AS total, count(*) AS opp_count
  FROM opportunities o
  WHERE status = 'OPEN'::opp_status AND (
    (pipeline = 'PUBLIC_BID'::pipeline_type AND stage = ANY (ARRAY['BIDDING','ESTIMATED','SUBMITTED']))
    OR (pipeline = 'GC_CHASE'::pipeline_type AND stage = ANY (ARRAY['BIDDING','ESTIMATED','SUBMITTED','GC_AWARDED']))
    OR (pipeline = 'FACILITY'::pipeline_type AND stage = ANY (ARRAY['PROPOSAL','APPROVAL']))
  )
  GROUP BY pipeline;

CREATE OR REPLACE VIEW v_bond_exposure AS
  SELECT COALESCE(sum(o.amount) FILTER (WHERE b.bond_required = true) / NULLIF(sum(o.amount), 0::numeric), 0::numeric) AS bond_pct,
         COALESCE(sum(o.amount) FILTER (WHERE b.bond_required = true), 0::numeric) AS bonded_dollars,
         COALESCE(sum(o.amount), 0::numeric) AS total_dollars
  FROM opportunities o JOIN bids b ON b.opportunity_id = o.id
  WHERE o.status = 'OPEN'::opp_status
    AND o.pipeline = ANY (ARRAY['PUBLIC_BID'::pipeline_type, 'GC_CHASE'::pipeline_type])
    AND o.stage = ANY (ARRAY['BIDDING','ESTIMATED','SUBMITTED','GC_AWARDED']);

CREATE OR REPLACE VIEW v_bid_out_awaiting AS
  SELECT o.id AS opp_id, o.name AS project_name, c.name AS company_name, o.pipeline,
         COALESCE(bq.quoted_amount, o.amount) AS our_number, b.bid_due_at AS decision_date,
         CASE WHEN b.bid_due_at IS NOT NULL THEN (b.bid_due_at::date - CURRENT_DATE) ELSE NULL::integer END AS days_until,
         gc.name AS gc_name
  FROM bid_quotes bq
    JOIN opportunities o ON o.id = bq.opportunity_id
    JOIN companies c ON c.id = o.company_id
    JOIN bids b ON b.opportunity_id = o.id
    JOIN companies gc ON gc.id = bq.gc_company_id
  WHERE o.status = 'OPEN'::opp_status AND o.pipeline = 'PUBLIC_BID'::pipeline_type
    AND bq.carried_us = true AND bq.gc_won_award = false
  UNION ALL
  SELECT o.id, o.name, c.name, o.pipeline, o.amount, b.bid_due_at,
         CASE WHEN b.bid_due_at IS NOT NULL THEN (b.bid_due_at::date - CURRENT_DATE) ELSE NULL::integer END,
         NULL::text
  FROM opportunities o JOIN companies c ON c.id = o.company_id
    LEFT JOIN bids b ON b.opportunity_id = o.id
  WHERE o.status = 'OPEN'::opp_status AND o.pipeline = 'GC_CHASE'::pipeline_type
    AND o.stage = ANY (ARRAY['SUBMITTED','GC_AWARDED'])
  UNION ALL
  SELECT o.id, o.name, c.name, o.pipeline, o.amount, NULL::timestamptz, NULL::integer, NULL::text
  FROM opportunities o JOIN companies c ON c.id = o.company_id
  WHERE o.status = 'OPEN'::opp_status AND o.pipeline = 'FACILITY'::pipeline_type
    AND o.stage = ANY (ARRAY['PROPOSAL','APPROVAL']);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run manually; forward-only repo). Restores pre-00076 state exactly.
-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER TABLE opportunities DROP CONSTRAINT chk_stage_in_pipeline;
-- UPDATE opportunities SET stage='ESTIMATING' WHERE pipeline='PUBLIC_BID' AND stage='ESTIMATED';
-- UPDATE opportunities SET stage='ON_THE_LIST' WHERE pipeline='GC_CHASE' AND stage='QUALIFIED';
-- -- the 3 pinned PlanHub ids back to QUOTING (only those — other GC_CHASE SUBMITTED left as-is):
-- UPDATE opportunities SET stage='QUOTING' WHERE id IN (
--   '98e4c6d1-208e-49a2-a6b4-2dbbd58d9a3a',  -- AutoZone - Burton, MI
--   '19357017-48bb-4cc1-bac2-d7045f1f4586',  -- Burlington Fit Out in Akron, OH
--   '8b148df2-61f7-43eb-a920-4b6648ab25bf'); -- Casey's in Grand Haven, MI
-- UPDATE opportunity_stage_history h SET from_stage='ESTIMATING' FROM opportunities o
--   WHERE h.opportunity_id=o.id AND o.pipeline='PUBLIC_BID' AND h.from_stage='ESTIMATED';
-- UPDATE opportunity_stage_history h SET to_stage='ESTIMATING' FROM opportunities o
--   WHERE h.opportunity_id=o.id AND o.pipeline='PUBLIC_BID' AND h.to_stage='ESTIMATED';
-- UPDATE opportunity_stage_history h SET from_stage='ON_THE_LIST' FROM opportunities o
--   WHERE h.opportunity_id=o.id AND o.pipeline='GC_CHASE' AND h.from_stage='QUALIFIED';
-- UPDATE opportunity_stage_history h SET to_stage='ON_THE_LIST' FROM opportunities o
--   WHERE h.opportunity_id=o.id AND o.pipeline='GC_CHASE' AND h.to_stage='QUALIFIED';
-- Then restore the pre-00076 valid_stage_for_pipeline / create_opportunity / advance_stage /
-- v_outstanding_bid_dollars / v_bond_exposure / v_bid_out_awaiting bodies (git history: pre-00076),
-- and re-add chk_stage_in_pipeline.
