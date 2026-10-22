-- 00090_proposal_price_points.sql
-- $/SF history from MCFC proposals, and the expected-wins price term switched to use it.
--
--   proposals.square_feet / system / option_label / price_per_sf   one row per priced line or option
--   uq_proposals_number_version     now includes option_label (alternates share a number)
--   v_price_points                  + 'MCFC_PROPOSAL' rows
--   v_proposal_price_bench          median $/SF per system × size band, from SENT/DRAFTED proposals
--   v_expected_wins                 price term = bid $/SF vs. that median (leave-one-out, ratio clamped)
--
-- Size bands: S < 2,500 SF · M 2,500–14,999 · L ≥ 15,000 ($/SF falls steeply with size).
-- The price term is deliberately weak (price_coef −1.0, ratio clamped to 0.5–2.0): the benchmark is
-- our own pricing, not the market's. Replace it with winning-bid $/SF once competitor_bids carry SF.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS square_feet numeric;
ALTER TABLE proposals ADD CONSTRAINT proposals_sf_positive CHECK (square_feet IS NULL OR square_feet > 0);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS system text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS option_label text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS price_per_sf numeric
  GENERATED ALWAYS AS (CASE WHEN square_feet > 0 AND amount > 0 THEN round(amount / square_feet, 4) END) STORED;
-- uq_proposals_number_version (number, version) is kept as is: alternates/line items of one proposal
-- carry the number on the base row only (option rows: proposal_number NULL, number in notes).

CREATE OR REPLACE FUNCTION public.sf_band(p_sf numeric) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN p_sf IS NULL THEN NULL WHEN p_sf < 2500 THEN 'S' WHEN p_sf < 15000 THEN 'M' ELSE 'L' END;
$$;

INSERT INTO win_model_params (key, value, note) VALUES
 ('price_ratio_min', 0.5, 'Clamp: bid $/SF ÷ benchmark is floored here before the price term'),
 ('price_ratio_max', 2.0, 'Clamp: bid $/SF ÷ benchmark is capped here before the price term')
ON CONFLICT (key) DO NOTHING;
UPDATE win_model_params SET value = -1.0,
  note = 'Log-odds per 1.0 of (bid $/SF ÷ our median for system+size − 1). Weak on purpose: benchmark is our own pricing'
 WHERE key = 'price_coef';
UPDATE win_model_params SET note = 'Other proposals needed in the same system + size band before the price term switches on'
 WHERE key = 'price_min_comparables';

CREATE OR REPLACE VIEW v_proposal_price_bench WITH (security_invoker = true) AS
SELECT p.system, sf_band(p.square_feet) AS band, count(*) AS n,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY p.price_per_sf))::numeric, 2) AS median_per_sf,
       round(min(p.price_per_sf), 2) AS min_per_sf, round(max(p.price_per_sf), 2) AS max_per_sf
  FROM proposals p
 WHERE p.status IN ('SENT', 'DRAFTED') AND p.price_per_sf IS NOT NULL AND p.system IS NOT NULL
 GROUP BY 1, 2;

CREATE OR REPLACE VIEW v_price_points WITH (security_invoker = true) AS
  SELECT 'MCFC_ESTIMATE'::text AS source, e.opportunity_id, o.name AS opportunity_name, o.pipeline, o.status AS opportunity_status,
         'MotorCity Floors and Coatings' AS party, e.system, e.square_feet, coalesce(e.approved_price, e.recommended_price) AS amount,
         e.price_per_sf, e.created_at::date AS observed_on
    FROM estimates e JOIN opportunities o ON o.id = e.opportunity_id
   WHERE e.status <> 'SUPERSEDED'
  UNION ALL
  SELECT 'SUB_QUOTE', s.opportunity_id, o.name, o.pipeline, o.status, s.sub_name, s.system, s.square_feet, s.amount, s.price_per_sf,
         coalesce(s.received_at, s.created_at::date)
    FROM sub_quotes s JOIN opportunities o ON o.id = s.opportunity_id
   WHERE s.quote_type <> 'material'
  UNION ALL
  SELECT CASE WHEN c.is_winner THEN 'WINNING_BID' ELSE 'COMPETITOR_BID' END, c.opportunity_id, o.name, o.pipeline, o.status,
         c.bidder_name, NULL::text, NULL::numeric, c.amount, NULL::numeric, c.created_at::date
    FROM competitor_bids c JOIN opportunities o ON o.id = c.opportunity_id
  UNION ALL
  SELECT 'MCFC_PROPOSAL', p.opportunity_id, o.name, o.pipeline, o.status, 'MotorCity Floors and Coatings', p.system,
         p.square_feet, p.amount, p.price_per_sf, coalesce(p.sent_at, p.created_at)::date
    FROM proposals p JOIN opportunities o ON o.id = p.opportunity_id
   WHERE p.status IN ('SENT', 'DRAFTED');

-- v_expected_wins: same columns as 00089, new price columns appended at the end (CREATE OR REPLACE).
CREATE OR REPLACE VIEW v_expected_wins WITH (security_invoker = true) AS
WITH gc AS (   -- each GC's own record, shrunk toward its pipeline's base rate
  SELECT coalesce(b.gc_company_id, o.company_id) AS gc_id, o.pipeline,
         count(*) FILTER (WHERE o.status = 'WON') AS wins, count(*) AS decided
    FROM opportunities o LEFT JOIN bids b ON b.opportunity_id = o.id
   WHERE o.status IN ('WON', 'LOST') AND o.duplicate_of IS NULL
     AND coalesce(b.gc_company_id, o.company_id) <> 'c29127cf-f778-57bd-9238-c37ce96878ee'
   GROUP BY 1, 2
), haircut AS (
  SELECT CASE WHEN count(*) >= 3 THEN avg(final_value / amount) ELSE win_param('haircut_default') END AS h
    FROM opportunities WHERE status = 'WON' AND final_value IS NOT NULL AND amount > 0
), est AS (
  SELECT DISTINCT ON (opportunity_id) opportunity_id, system
    FROM estimates WHERE status <> 'SUPERSEDED' ORDER BY opportunity_id, created_at DESC
), prop AS (   -- the bid's own priced proposal (base line preferred over options, newest first)
  SELECT DISTINCT ON (opportunity_id) opportunity_id, system, square_feet, price_per_sf
    FROM proposals WHERE status IN ('SENT', 'DRAFTED') AND price_per_sf IS NOT NULL AND system IS NOT NULL
   ORDER BY opportunity_id, (option_label IS NULL) DESC, coalesce(sent_at, created_at) DESC
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
         coalesce(prop.system, est.system) AS system, prop.system AS prop_system, prop.square_feet AS prop_sf, prop.price_per_sf
    FROM opportunities o
    LEFT JOIN bids b ON b.opportunity_id = o.id
    LEFT JOIN federal_details f ON f.opportunity_id = o.id
    LEFT JOIN est ON est.opportunity_id = o.id
    LEFT JOIN prop ON prop.opportunity_id = o.id
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
              THEN win_param('price_coef') * (greatest(least(l2.price_per_sf / pb.bench, win_param('price_ratio_max')), win_param('price_ratio_min')) - 1)
              ELSE 0 END AS lo_price,
         CASE WHEN pb.n >= win_param('price_min_comparables') THEN round((l2.price_per_sf / pb.bench)::numeric, 3) END AS price_ratio,
         pb.bench AS price_bench, pb.n AS price_comparables
    FROM l2
    LEFT JOIN gc g ON g.gc_id = l2.gc_id AND g.pipeline = l2.pipeline
    LEFT JOIN LATERAL (   -- leave-one-out median of other jobs' proposals, same system + size band
      SELECT (percentile_cont(0.5) WITHIN GROUP (ORDER BY p2.price_per_sf))::numeric AS bench, count(*) AS n
        FROM proposals p2
       WHERE p2.status IN ('SENT', 'DRAFTED') AND p2.price_per_sf IS NOT NULL
         AND p2.system = l2.prop_system AND sf_band(p2.square_feet) = sf_band(l2.prop_sf)
         AND p2.opportunity_id <> l2.id) pb ON true
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
       (l6.amount IS NULL)         AS missing_amount,
       round(l6.price_per_sf, 2)   AS bid_per_sf,
       round(l6.price_bench, 2)    AS price_bench_per_sf,
       l6.price_comparables
  FROM l6 CROSS JOIN haircut h;

-- NOTE (2026-10-22): applied via the Supabase MCP execute_sql tool in chunks, recorded as 00090.
-- That tool waits for a human confirmation on any DROP statement, so this migration avoids DROP entirely.

-- Reclassify grind-and-seal jobs out of plain 'sealer' so the sealer benchmark is not mixed with grinding work.
UPDATE proposals SET system = 'grind_seal'
 WHERE system = 'sealer'
   AND opportunity_id IN ('b7d7d063-d390-5fa5-8c12-010022be0122','2af2227e-6a0c-5d32-9219-626af4aa5c42',
                          '8de7dd27-f695-51fb-8f17-c24d8b2eeb8f','23d4a43a-f911-52e9-8f4f-ca730f1b4778',
                          '82409944-e17f-5fe1-872f-36dd575e5680','7dd91c05-6922-59a8-b0cf-896f2c2dd7e7');
