-- 00089_expected_wins_model.sql
-- Expected-wins model: P(win) per open bid, built in layers, instead of "win rate × open volume".
--
--   win_model_params        every tunable number lives here (Jordan edits rows, not code)
--   bids.gc_bidders_count / our_gc_count / flooring_bidders   competition inputs (nullable)
--   win_param(key)          reads a parameter
--   v_win_base_rates        decided wins/losses per pipeline, shrunk toward a prior (Beta-binomial)
--   v_expected_wins         one row per OPEN bid: every layer of the calculation, p_win, expected $
--   v_expected_wins_summary totals by pipeline + all, naive comparison, standard deviation
--   simulate_expected_wins  Monte Carlo: P10/P50/P90 of won $ and P(hitting a goal by a date)
--   win_prob_snapshots      the model's prediction saved when a bid is submitted (for calibration)
--
-- P(win) layers (see v_expected_wins columns):
--   1 base      = (wins + k·prior) / (decided + k)                         per pipeline
--   2 path      = GC_CHASE: base × (GC share ÷ typical share), capped at p_proceed·p_carry
--                 GC_CHASE at GC_AWARDED: p_carry (the GC already won; will they carry us?)
--                 other pipelines: base
--   3 stage     × stage factor (chance a not-yet-submitted bid actually goes out)
--   4 adjust    logit shift: GC relationship (GC's own record, shrunk) + price vs. benchmark
--   5 silence   Bayes update for days without news: p·S_win / (p·S_win + (1−p)·S_lose)
--                 S_win(t)  = exp(−t/τ_win)                      wins are announced quickly
--                 S_lose(t) = q + (1−q)·exp(−t/τ_lose)           q = share of losses never reported
--   expected $  = amount × haircut × p_win ;  variance = (amount × haircut)² · p(1−p)

-- ── parameters ──
CREATE TABLE IF NOT EXISTS win_model_params (
  key         text        PRIMARY KEY,
  value       numeric     NOT NULL,
  note        text        NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE win_model_params ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS win_model_params_read ON win_model_params;
CREATE POLICY win_model_params_read ON win_model_params FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS win_model_params_admin ON win_model_params;
CREATE POLICY win_model_params_admin ON win_model_params FOR ALL
  USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');

INSERT INTO win_model_params (key, value, note) VALUES
 ('prior_strength',             10,   'k: how many decided bids the prior is worth. Higher = trust your own record less'),
 ('prior_GC_CHASE',             0.15, 'Prior win rate, GC bids (sub bidding to GCs)'),
 ('prior_PUBLIC_BID',           0.15, 'Prior win rate, public low-bid jobs'),
 ('prior_FACILITY',             0.30, 'Prior win rate, owner-direct proposals'),
 ('prior_FEDERAL',              0.20, 'Prior win rate, federal set-aside quotes'),
 ('gc_typical_share',           0.33, 'Typical share of bidding GCs we are carried by (base rate already includes this)'),
 ('gc_p_proceed',               0.85, 'Chance a GC-bid project goes ahead at all'),
 ('gc_p_carry',                 0.40, 'Chance the winning GC uses us, given we bid to that GC'),
 ('gc_credibility',             5,    'm: decided bids with one GC before its own record counts as much as the average'),
 ('price_coef',                 -3,   'Log-odds per 1.0 of (our $/SF ÷ benchmark − 1). -3 → 10% high costs 0.3 log-odds'),
 ('price_min_comparables',      3,    'Won jobs with SF needed per system before the price term switches on'),
 ('tau_win_days',               25,   'Wins: mean days from bid to hearing we won (commercial)'),
 ('tau_win_days_federal',       45,   'Wins: mean days from submission to award (federal)'),
 ('tau_lose_days',              30,   'Reported losses: mean days to hearing'),
 ('lose_never_told_share',      0.60, 'q: share of losses where nobody ever tells us'),
 ('decision_days',              30,   'Expected days from bid to decision (commercial), for timing'),
 ('decision_days_federal',      60,   'Expected days from submission to award (federal), for timing'),
 ('haircut_default',            1.00, 'Won $ ÷ bid $ until 3 wins have final_value recorded'),
 ('stage_GC_CHASE_QUALIFIED',   0.50, 'Chance a QUALIFIED GC bid is actually submitted'),
 ('stage_GC_CHASE_BIDDING',     0.70, 'Chance a BIDDING GC bid is actually submitted'),
 ('stage_GC_CHASE_ESTIMATED',   0.90, 'Chance a priced GC bid is actually submitted'),
 ('stage_PUBLIC_BID_SOURCED',   0.40, 'Chance a SOURCED public bid is submitted'),
 ('stage_PUBLIC_BID_BIDDING',   0.60, 'Chance a BIDDING public bid is submitted'),
 ('stage_PUBLIC_BID_ESTIMATED', 0.90, 'Chance a priced public bid is submitted'),
 ('stage_FACILITY_ENGAGED',     0.40, 'Chance an ENGAGED owner lead reaches a proposal'),
 ('stage_FACILITY_SITE_WALK',   0.60, 'Chance a site-walked owner lead reaches a proposal'),
 ('stage_FACILITY_PROPOSAL',    0.90, 'Chance a proposal in progress is sent'),
 ('stage_FEDERAL_INTAKE',       0.40, 'Chance a federal INTAKE job is submitted'),
 ('stage_FEDERAL_EXTRACTION',   0.50, 'Chance a federal EXTRACTION job is submitted'),
 ('stage_FEDERAL_SCORING',      0.60, 'Chance a federal SCORING job is submitted'),
 ('stage_FEDERAL_ESTIMATING',   0.80, 'Chance a federal ESTIMATING job is submitted')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.win_param(p_key text) RETURNS numeric
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT value FROM win_model_params WHERE key = p_key;
$$;

-- ── competition inputs on bids ──
ALTER TABLE bids ADD COLUMN IF NOT EXISTS gc_bidders_count integer CHECK (gc_bidders_count IS NULL OR gc_bidders_count > 0);
ALTER TABLE bids ADD COLUMN IF NOT EXISTS our_gc_count integer CHECK (our_gc_count IS NULL OR our_gc_count > 0);
ALTER TABLE bids ADD COLUMN IF NOT EXISTS flooring_bidders integer CHECK (flooring_bidders IS NULL OR flooring_bidders > 0);
COMMENT ON COLUMN bids.gc_bidders_count IS 'How many GCs are bidding the project (expected-wins model)';
COMMENT ON COLUMN bids.our_gc_count IS 'How many of those GCs we sent our number to';
COMMENT ON COLUMN bids.flooring_bidders IS 'Flooring subs competing, when known';

-- ── base rates ──
CREATE OR REPLACE VIEW v_win_base_rates WITH (security_invoker = true) AS
SELECT p.pipeline,
       coalesce(d.wins, 0)  AS wins,
       coalesce(d.decided, 0) AS decided,
       win_param('prior_' || p.pipeline::text) AS prior,
       round((coalesce(d.wins, 0) + win_param('prior_strength') * win_param('prior_' || p.pipeline::text))
             / (coalesce(d.decided, 0) + win_param('prior_strength')), 4) AS base_rate,
       CASE WHEN coalesce(d.decided, 0) > 0 THEN round(d.wins::numeric / d.decided, 4) END AS raw_rate
  FROM unnest(enum_range(NULL::pipeline_type)) AS p(pipeline)
  LEFT JOIN (SELECT pipeline, count(*) FILTER (WHERE status = 'WON') AS wins, count(*) AS decided
               FROM opportunities WHERE status IN ('WON', 'LOST') AND duplicate_of IS NULL GROUP BY 1) d
    ON d.pipeline = p.pipeline;

-- ── per-bid model ──
CREATE OR REPLACE VIEW v_expected_wins WITH (security_invoker = true) AS
WITH gc AS (   -- each GC's own record, shrunk toward its pipeline's base rate
  SELECT coalesce(b.gc_company_id, o.company_id) AS gc_id, o.pipeline,
         count(*) FILTER (WHERE o.status = 'WON') AS wins, count(*) AS decided
    FROM opportunities o LEFT JOIN bids b ON b.opportunity_id = o.id
   WHERE o.status IN ('WON', 'LOST') AND o.duplicate_of IS NULL
     AND coalesce(b.gc_company_id, o.company_id) <> 'c29127cf-f778-57bd-9238-c37ce96878ee'
   GROUP BY 1, 2
), price_bench AS (   -- median $/SF on WON jobs per system, once enough comparables exist
  SELECT e.system, (percentile_cont(0.5) WITHIN GROUP (ORDER BY e.price_per_sf))::numeric AS bench, count(*) AS n
    FROM estimates e JOIN opportunities o ON o.id = e.opportunity_id
   WHERE o.status = 'WON' AND e.price_per_sf IS NOT NULL AND e.status <> 'SUPERSEDED'
   GROUP BY 1
), haircut AS (
  SELECT CASE WHEN count(*) >= 3 THEN avg(final_value / amount) ELSE win_param('haircut_default') END AS h
    FROM opportunities WHERE status = 'WON' AND final_value IS NOT NULL AND amount > 0
), est AS (
  SELECT DISTINCT ON (opportunity_id) opportunity_id, system, price_per_sf
    FROM estimates WHERE status <> 'SUPERSEDED' ORDER BY opportunity_id, created_at DESC
), o AS (
  SELECT o.id, o.name, o.pipeline, o.stage, o.amount,
         coalesce(b.gc_company_id, o.company_id) AS gc_id,
         (SELECT c.name FROM companies c WHERE c.id = coalesce(b.gc_company_id, o.company_id)) AS gc_name,
         b.gc_bidders_count, b.our_gc_count,
         br.base_rate,
         (o.stage IN ('SUBMITTED', 'GC_AWARDED', 'APPROVAL')) AS is_out,
         CASE WHEN o.stage = 'GC_AWARDED' THEN coalesce(o.stage_entered_at, o.updated_at)
              ELSE coalesce(b.gc_bid_date, f.response_deadline, b.bid_due_at, o.stage_entered_at) END AS clock_start,
         coalesce(b.bid_due_at, f.response_deadline) AS due_at,
         est.system, est.price_per_sf
    FROM opportunities o
    LEFT JOIN bids b ON b.opportunity_id = o.id
    LEFT JOIN federal_details f ON f.opportunity_id = o.id
    LEFT JOIN est ON est.opportunity_id = o.id
    JOIN v_win_base_rates br ON br.pipeline = o.pipeline
   WHERE o.status = 'OPEN' AND o.duplicate_of IS NULL
), l2 AS (
  SELECT o.*,
         CASE
           WHEN o.pipeline = 'GC_CHASE' AND o.stage = 'GC_AWARDED' THEN win_param('gc_p_carry')
           WHEN o.pipeline = 'GC_CHASE' AND o.gc_bidders_count IS NOT NULL THEN
             least(o.base_rate * least(coalesce(o.our_gc_count, 1)::numeric / o.gc_bidders_count, 1) / win_param('gc_typical_share'),
                   win_param('gc_p_proceed') * win_param('gc_p_carry'))
           ELSE o.base_rate
         END AS p_path,
         coalesce(win_param('stage_' || o.pipeline::text || '_' || o.stage), 1) AS stage_factor
    FROM o
), l4 AS (
  SELECT l2.*,
         greatest(least(l2.p_path * l2.stage_factor, 0.999), 0.001) AS p_stage,
         CASE WHEN g.decided > 0 THEN
           ln(((g.wins + win_param('gc_credibility') * l2.base_rate) / (g.decided + win_param('gc_credibility')))
              / (1 - (g.wins + win_param('gc_credibility') * l2.base_rate) / (g.decided + win_param('gc_credibility'))))
           - ln(l2.base_rate / (1 - l2.base_rate))
         ELSE 0 END AS lo_gc,
         g.wins AS gc_wins, g.decided AS gc_decided,
         CASE WHEN pb.n >= win_param('price_min_comparables') AND l2.price_per_sf IS NOT NULL
              THEN win_param('price_coef') * (l2.price_per_sf / pb.bench - 1) ELSE 0 END AS lo_price,
         CASE WHEN pb.n >= win_param('price_min_comparables') THEN round((l2.price_per_sf / pb.bench)::numeric, 3) END AS price_ratio
    FROM l2
    LEFT JOIN gc g ON g.gc_id = l2.gc_id AND g.pipeline = l2.pipeline
    LEFT JOIN price_bench pb ON pb.system = l2.system
), l5 AS (
  SELECT l4.*,
         1 / (1 + exp(-(ln(l4.p_stage / (1 - l4.p_stage)) + l4.lo_gc + l4.lo_price))) AS p_adj,
         CASE WHEN l4.is_out AND l4.clock_start IS NOT NULL
              THEN greatest(extract(epoch FROM now() - l4.clock_start) / 86400, 0) ELSE 0 END AS days_silent
    FROM l4
), l6 AS (
  SELECT l5.*,
         exp(-l5.days_silent / CASE WHEN l5.pipeline = 'FEDERAL' THEN win_param('tau_win_days_federal') ELSE win_param('tau_win_days') END) AS s_win,
         win_param('lose_never_told_share') + (1 - win_param('lose_never_told_share')) * exp(-l5.days_silent / win_param('tau_lose_days')) AS s_lose
    FROM l5
)
SELECT l6.id AS opportunity_id, l6.name, l6.pipeline, l6.stage, l6.gc_name, l6.system,
       l6.amount,
       round(l6.base_rate, 4)      AS p_base,
       round(l6.p_path, 4)         AS p_path,
       l6.stage_factor,
       round(l6.lo_gc, 3)          AS logodds_gc,
       l6.gc_wins, l6.gc_decided,
       l6.price_ratio,
       round(l6.lo_price, 3)       AS logodds_price,
       round(l6.p_adj, 4)          AS p_before_silence,
       round(l6.days_silent)       AS days_silent,
       round((l6.p_adj * l6.s_win / (l6.p_adj * l6.s_win + (1 - l6.p_adj) * l6.s_lose)), 4) AS p_win,
       h.h                         AS haircut,
       round(coalesce(l6.amount, 0) * h.h * (l6.p_adj * l6.s_win / (l6.p_adj * l6.s_win + (1 - l6.p_adj) * l6.s_lose)), 2) AS expected_amount,
       round(power(coalesce(l6.amount, 0) * h.h, 2)
             * (l6.p_adj * l6.s_win / (l6.p_adj * l6.s_win + (1 - l6.p_adj) * l6.s_lose))
             * (1 - (l6.p_adj * l6.s_win / (l6.p_adj * l6.s_win + (1 - l6.p_adj) * l6.s_lose))), 2) AS variance,
       greatest(current_date,
         (coalesce(l6.clock_start, l6.due_at, now())
          + make_interval(days => (CASE WHEN l6.pipeline = 'FEDERAL' THEN win_param('decision_days_federal') ELSE win_param('decision_days') END)::int))::date)
                                   AS expected_decision_date,
       (l6.amount IS NULL)         AS missing_amount
  FROM l6 CROSS JOIN haircut h;

-- ── summary ──
CREATE OR REPLACE VIEW v_expected_wins_summary WITH (security_invoker = true) AS
WITH naive AS (
  SELECT sum(amount) FILTER (WHERE status = 'WON') / nullif(sum(amount), 0) AS dollar_win_rate
    FROM opportunities WHERE status IN ('WON', 'LOST') AND duplicate_of IS NULL
)
SELECT coalesce(e.pipeline::text, 'ALL') AS pipeline,
       count(*)                                   AS open_bids,
       count(*) FILTER (WHERE e.missing_amount)   AS bids_without_amount,
       round(sum(coalesce(e.amount, 0)))          AS open_amount,
       round(sum(e.expected_amount))              AS expected_won,
       round(sqrt(sum(e.variance)))               AS std_dev,
       round(greatest(sum(e.expected_amount) - 1.2816 * sqrt(sum(e.variance)), 0)) AS approx_p10,
       round(sum(e.expected_amount) + 1.2816 * sqrt(sum(e.variance)))              AS approx_p90,
       round(sum(coalesce(e.amount, 0)) * (SELECT dollar_win_rate FROM naive))      AS naive_expected,
       round((SELECT dollar_win_rate FROM naive), 3)                                AS naive_rate
  FROM v_expected_wins e
 GROUP BY ROLLUP (e.pipeline);

-- ── Monte Carlo: won $ distribution and chance of hitting a goal ──
-- p_by: only bids expected to be decided on or before this date count (default: year end).
-- p_goal_remaining: dollars still needed (e.g. annual goal minus won YTD).
CREATE OR REPLACE FUNCTION public.simulate_expected_wins(
  p_runs int DEFAULT 5000, p_by date DEFAULT (date_trunc('year', now()) + interval '1 year - 1 day')::date,
  p_goal_remaining numeric DEFAULT NULL
) RETURNS TABLE(runs int, bids int, mean numeric, p10 numeric, p50 numeric, p90 numeric, prob_goal numeric)
LANGUAGE sql VOLATILE SET search_path TO 'public' AS $$
  WITH b AS MATERIALIZED (
    SELECT row_number() OVER () AS i, coalesce(amount, 0) * haircut AS a, p_win
      FROM v_expected_wins WHERE coalesce(amount, 0) > 0 AND expected_decision_date <= p_by
  ), r AS (
    SELECT g AS run, sum(CASE WHEN random() < b.p_win THEN b.a ELSE 0 END) AS tot
      FROM generate_series(1, p_runs) g CROSS JOIN b GROUP BY g
  )
  SELECT p_runs, (SELECT count(*)::int FROM b), round(avg(tot)),
         round(percentile_cont(0.1) WITHIN GROUP (ORDER BY tot)::numeric),
         round(percentile_cont(0.5) WITHIN GROUP (ORDER BY tot)::numeric),
         round(percentile_cont(0.9) WITHIN GROUP (ORDER BY tot)::numeric),
         CASE WHEN p_goal_remaining IS NULL THEN NULL ELSE round(avg((tot >= p_goal_remaining)::int), 3) END
    FROM r
$$;

-- ── calibration: save the prediction when a bid goes out ──
CREATE TABLE IF NOT EXISTS win_prob_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  snapshot_at     timestamptz NOT NULL DEFAULT now(),
  reason          text        NOT NULL,                 -- 'submitted' | 'baseline' | 'manual'
  stage           text,
  amount          numeric,
  p_win           numeric     NOT NULL,
  components      jsonb       NOT NULL,                 -- the full v_expected_wins row
  model_version   text        NOT NULL DEFAULT 'v1-2026-10-22'
);
CREATE INDEX IF NOT EXISTS idx_win_prob_snapshots_opp ON win_prob_snapshots (opportunity_id, snapshot_at);
ALTER TABLE win_prob_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS win_prob_snapshots_admin_all ON win_prob_snapshots;
CREATE POLICY win_prob_snapshots_admin_all ON win_prob_snapshots FOR ALL
  USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');
DROP POLICY IF EXISTS win_prob_snapshots_owner_select ON win_prob_snapshots;
CREATE POLICY win_prob_snapshots_owner_select ON win_prob_snapshots FOR SELECT USING (current_app_role() = 'owner');

CREATE OR REPLACE FUNCTION public.snapshot_win_probs(p_reason text DEFAULT 'manual', p_opportunity uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH ins AS (
    INSERT INTO win_prob_snapshots (opportunity_id, reason, stage, amount, p_win, components)
    SELECT e.opportunity_id, p_reason, e.stage, e.amount, e.p_win, to_jsonb(e)
      FROM v_expected_wins e
     WHERE p_opportunity IS NULL OR e.opportunity_id = p_opportunity
    RETURNING 1)
  SELECT count(*)::int FROM ins
$$;

CREATE OR REPLACE FUNCTION public.trg_snapshot_on_submit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.stage IN ('SUBMITTED', 'APPROVAL') AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    PERFORM snapshot_win_probs('submitted', NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS opportunities_snapshot_on_submit ON opportunities;
CREATE TRIGGER opportunities_snapshot_on_submit AFTER UPDATE OF stage ON opportunities
  FOR EACH ROW EXECUTE FUNCTION trg_snapshot_on_submit();

-- calibration readout: predictions made at submission vs. what happened
CREATE OR REPLACE VIEW v_win_calibration WITH (security_invoker = true) AS
WITH first_pred AS (
  SELECT DISTINCT ON (opportunity_id) opportunity_id, p_win, snapshot_at
    FROM win_prob_snapshots WHERE reason IN ('submitted', 'baseline') ORDER BY opportunity_id, snapshot_at
)
SELECT width_bucket(fp.p_win, 0, 1, 10) AS bucket,
       round(min(fp.p_win), 3) AS p_low, round(max(fp.p_win), 3) AS p_high,
       count(*) AS decided, round(avg(fp.p_win), 3) AS predicted,
       round(avg((o.status = 'WON')::int), 3) AS actual,
       round(avg(power((o.status = 'WON')::int - fp.p_win, 2)), 4) AS brier
  FROM first_pred fp JOIN opportunities o ON o.id = fp.opportunity_id
 WHERE o.status IN ('WON', 'LOST')
 GROUP BY 1 ORDER BY 1;

REVOKE ALL ON FUNCTION public.snapshot_win_probs(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snapshot_win_probs(text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_snapshot_on_submit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.simulate_expected_wins(int, date, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simulate_expected_wins(int, date, numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.win_param(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.win_param(text) TO authenticated, service_role;

-- NOTE (2026-10-22): applied to production via the Supabase MCP execute_sql tool in chunks and
-- recorded as version 00089. The bids competition fields start empty (the "(1 of 3 GCs)" text lives
-- in company names on disqualified jobs, so there was nothing to backfill). Baseline snapshot below.
SELECT snapshot_win_probs('baseline');
