-- 00082_close_loss_and_bid_triage.sql
-- Universal "Close Loss" (from ANY stage) + Bid / No-Bid triage RPCs.
--
-- Consumes the NO_BID enum value added in 00081 (separate file on purpose —
-- see the note there).
--
-- SCHEMA NOTES / deliberate reuse of what already exists:
--   * REASON TEXT reuses opportunities.lost_reason (added in 00005, already
--     the gate-checklist target per lib/gates/labels.ts). A second
--     closed_loss_reason column would be the same fact in two places.
--   * BID DUE DATE is NOT added to opportunities. It already exists as
--     bids.bid_due_at (PUBLIC_BID / GC_CHASE) and
--     federal_details.response_deadline (FEDERAL) — both already driving the
--     cadence engine and the 7-Day Bid Outlook. A third column would have to
--     be kept in sync with those by hand.
--   * The BID affirmative reuses bids.go_no_go, which is exactly this decision.
--
-- Only genuinely new state here: closed_loss_at (when the loss was recorded,
-- as distinct from stage_entered_at / updated_at, which any later edit moves).

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS closed_loss_at timestamptz;

COMMENT ON COLUMN opportunities.closed_loss_at IS
  'When the deal was explicitly closed as a loss via close_opportunity_loss(). Reason text lives in lost_reason.';

-- ─────────────────────────────────────────────────────────────────────────────
-- close_opportunity_loss — stage-independent loss close.
--
-- advance_stage() only allows LOST out of SUBMITTED / GC_AWARDED / APPROVAL and
-- gates it behind "bid due date has passed". A deal can die at SOURCED, so this
-- is a separate path that skips the stage chain and the gates by design. It
-- still lands on the existing terminal stage LOST + status LOST (every pipeline
-- already has a LOST stage — no new stage is introduced) and still writes
-- opportunity_stage_history, so the audit trail and win-rate views are intact.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_opportunity_loss(p_opp_id uuid, p_reason text)
 RETURNS TABLE(id uuid, stage text, status opp_status)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_opp opportunities%ROWTYPE;
  v_role text;
  v_old_stage text;
BEGIN
  SELECT * INTO v_opp FROM opportunities WHERE opportunities.id = p_opp_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found: %', p_opp_id; END IF;

  v_role := (SELECT role::text FROM user_profiles WHERE user_profiles.id = auth.uid());
  IF v_opp.owner_id != auth.uid() AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Permission denied: you do not own this opportunity';
  END IF;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- set_opportunity_no_bid — dashboard No Bid / undo.
--
-- STAGE IS LEFT ALONE on purpose: status = NO_BID already removes the deal from
-- every active-pipeline query, and keeping the stage records where the deal was
-- when we passed on it. p_no_bid => false reverses it, so a mis-tap on a phone
-- is not a dead end.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_opportunity_no_bid(p_opp_id uuid, p_no_bid boolean DEFAULT true)
 RETURNS TABLE(id uuid, stage text, status opp_status)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_opp opportunities%ROWTYPE;
  v_role text;
BEGIN
  SELECT * INTO v_opp FROM opportunities WHERE opportunities.id = p_opp_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found: %', p_opp_id; END IF;

  v_role := (SELECT role::text FROM user_profiles WHERE user_profiles.id = auth.uid());
  IF v_opp.owner_id != auth.uid() AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Permission denied: you do not own this opportunity';
  END IF;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- affirm_bid — the "Bid" button. Records the affirmative decision and clears a
-- prior No Bid. No stage movement: confirming intent to bid is not progress
-- through the pipeline, so advance_stage stays the only way to move a stage.
-- FACILITY/FEDERAL have no bids row, so there the flag write is a no-op and
-- this only reopens a no-bid.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.affirm_bid(p_opp_id uuid)
 RETURNS TABLE(id uuid, stage text, status opp_status)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_opp opportunities%ROWTYPE;
  v_role text;
BEGIN
  SELECT * INTO v_opp FROM opportunities WHERE opportunities.id = p_opp_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found: %', p_opp_id; END IF;

  v_role := (SELECT role::text FROM user_profiles WHERE user_profiles.id = auth.uid());
  IF v_opp.owner_id != auth.uid() AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Permission denied: you do not own this opportunity';
  END IF;

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
-- ─────────────────────────────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.affirm_bid(uuid);
-- DROP FUNCTION IF EXISTS public.set_opportunity_no_bid(uuid, boolean);
-- DROP FUNCTION IF EXISTS public.close_opportunity_loss(uuid, text);
-- ALTER TABLE opportunities DROP COLUMN IF EXISTS closed_loss_at;
-- (opp_status NO_BID is dropped by 00081's rollback.)
