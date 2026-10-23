-- Win probability on each opportunity comes from the expected-wins model
-- (v_expected_wins.p_win) instead of the fixed per-stage lookup / manual odds tiers.
-- Also fills expected_close_date from the model's expected decision date so the
-- weighted pipeline, 90-day forecast and "closing this month" views populate.

-- 1. Keep the old manual / stage-based numbers
CREATE TABLE IF NOT EXISTS public.win_probability_manual_backup (
  opportunity_id uuid PRIMARY KEY REFERENCES public.opportunities(id) ON DELETE CASCADE,
  win_probability numeric,
  expected_close_date date,
  saved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.win_probability_manual_backup ENABLE ROW LEVEL SECURITY;

INSERT INTO public.win_probability_manual_backup (opportunity_id, win_probability, expected_close_date)
SELECT id, win_probability, expected_close_date FROM public.opportunities
ON CONFLICT (opportunity_id) DO NOTHING;

-- 2. Write the model onto the opportunity record
CREATE OR REPLACE FUNCTION public.sync_win_probabilities(p_opportunity uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  UPDATE opportunities o
     SET win_probability     = round(e.p_win * 100),
         expected_close_date = e.expected_decision_date
    FROM v_expected_wins e
   WHERE e.opportunity_id = o.id
     AND (p_opportunity IS NULL OR o.id = p_opportunity)
     AND (o.win_probability IS DISTINCT FROM round(e.p_win * 100)
          OR o.expected_close_date IS DISTINCT FROM e.expected_decision_date);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.sync_win_probabilities(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_win_probabilities(uuid) TO authenticated, service_role;

-- 3. Re-sync on changes. Runs AFTER advance_stage_core's update, so it replaces the stage lookup.
CREATE OR REPLACE FUNCTION public.trg_sync_win_prob_opp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM sync_win_probabilities(NULL);   -- a win/loss changes GC track records for every job
  ELSE
    PERFORM sync_win_probabilities(NEW.id);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS opportunities_sync_win_prob ON public.opportunities;
CREATE TRIGGER opportunities_sync_win_prob
AFTER INSERT OR UPDATE OF stage, amount, status, pipeline, company_id, duplicate_of, stage_entered_at
ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.trg_sync_win_prob_opp();

CREATE OR REPLACE FUNCTION public.trg_sync_win_prob_child()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM sync_win_probabilities(COALESCE(NEW.opportunity_id, OLD.opportunity_id));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS bids_sync_win_prob ON public.bids;
CREATE TRIGGER bids_sync_win_prob AFTER INSERT OR UPDATE OR DELETE ON public.bids
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_win_prob_child();

DROP TRIGGER IF EXISTS proposals_sync_win_prob ON public.proposals;
CREATE TRIGGER proposals_sync_win_prob AFTER INSERT OR UPDATE OR DELETE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_win_prob_child();

DROP TRIGGER IF EXISTS federal_details_sync_win_prob ON public.federal_details;
CREATE TRIGGER federal_details_sync_win_prob AFTER INSERT OR UPDATE OR DELETE ON public.federal_details
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_win_prob_child();

-- 4. Initial sync
SELECT public.sync_win_probabilities(NULL);
