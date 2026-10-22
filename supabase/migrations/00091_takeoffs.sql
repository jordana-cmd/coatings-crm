-- 00091_takeoffs.sql
-- Plan takeoffs as data, so square footage is measured the same way every time and the method gets better with use.
--
--   takeoffs              one row per measured area (method, scale check, SF with a low/high range, cross-checks)
--   takeoff_lessons       short rules learned from misses; the mcfc-takeoff skill reads the active ones before every run
--   estimates.sf_source   where an estimate's SF came from (stated / measured / sub / field / eyeball) + range + takeoff link
--   v_takeoff_accuracy    each takeoff against the sub's SF and the field-verified SF, with a mismatch flag
--   v_takeoff_method_stats  the scoreboard: error and range hit-rate by method
--   agent_record_takeoff / agent_add_takeoff_lesson   service_role only (agents write through functions)
--
-- Applied via the Supabase MCP execute_sql tool in chunks on 2026-10-22, recorded as 00091.
-- That tool waits for a human confirmation on any DROP statement, so this migration contains no DROP.

CREATE TABLE IF NOT EXISTS public.takeoffs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id     uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  estimate_id        uuid REFERENCES public.estimates(id) ON DELETE SET NULL,
  area_label         text NOT NULL,
  finish_code        text,
  system             text,
  sheet              text,
  page               int,
  method             text NOT NULL CHECK (method IN
                       ('stated','vector_grid','vector_faces','written_dims','raster_grid','eyeball','sub','field')),
  scale_stated_ptft  numeric,
  scale_fit_ptft     numeric,
  scale_fit_err_pct  numeric GENERATED ALWAYS AS
                       (round((scale_fit_ptft - scale_stated_ptft) / nullif(scale_stated_ptft, 0) * 100, 2)) STORED,
  n_dims             int,
  sf                 numeric NOT NULL CHECK (sf > 0),
  sf_low             numeric,
  sf_high            numeric,
  perimeter_lf       numeric,
  cove_lf            numeric,
  cross_checks       jsonb NOT NULL DEFAULT '[]'::jsonb,
  check_image_url    text,
  agent              text,
  notes              text,
  field_sf           numeric CHECK (field_sf IS NULL OR field_sf > 0),
  field_sf_at        date,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid DEFAULT auth.uid(),
  CONSTRAINT takeoffs_range_ok CHECK (sf_low IS NULL OR sf_high IS NULL OR (sf_low <= sf AND sf <= sf_high))
);
CREATE INDEX IF NOT EXISTS takeoffs_opp_idx ON public.takeoffs(opportunity_id);
ALTER TABLE public.takeoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY takeoffs_rep_all ON public.takeoffs FOR ALL
  USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = takeoffs.opportunity_id AND o.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = takeoffs.opportunity_id AND o.owner_id = auth.uid()));
CREATE POLICY takeoffs_admin_all ON public.takeoffs FOR ALL
  USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');

CREATE TABLE IF NOT EXISTS public.takeoff_lessons (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson                 text NOT NULL,
  applies_when           text NOT NULL DEFAULT 'always',
  source_opportunity_id  uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  source_takeoff_id      uuid REFERENCES public.takeoffs(id) ON DELETE SET NULL,
  active                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.takeoff_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY takeoff_lessons_read ON public.takeoff_lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY takeoff_lessons_admin ON public.takeoff_lessons FOR ALL
  USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');

ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS sf_source text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS sf_low numeric;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS sf_high numeric;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS takeoff_id uuid REFERENCES public.takeoffs(id) ON DELETE SET NULL;
ALTER TABLE public.estimates ADD CONSTRAINT estimates_sf_source_chk CHECK (sf_source IS NULL OR sf_source IN
  ('stated','vector_grid','vector_faces','written_dims','raster_grid','eyeball','sub','field'));

-- ── accuracy: each takeoff vs the sub SF (same system when known) and the field-verified SF ──
CREATE OR REPLACE VIEW public.v_takeoff_accuracy WITH (security_invoker = true) AS
SELECT t.id AS takeoff_id, t.opportunity_id, o.name AS opportunity, o.status::text AS status,
       t.area_label, t.system, t.method, t.sf, t.sf_low, t.sf_high, t.scale_fit_err_pct, t.n_dims,
       sq.square_feet AS sub_sf, sq.sub_name,
       round((t.sf - sq.square_feet) / nullif(sq.square_feet, 0) * 100, 1) AS err_vs_sub_pct,
       t.field_sf,
       round((t.sf - t.field_sf) / nullif(t.field_sf, 0) * 100, 1) AS err_vs_field_pct,
       CASE WHEN t.field_sf IS NOT NULL THEN t.field_sf BETWEEN t.sf_low AND t.sf_high END AS field_in_range,
       (sq.square_feet IS NOT NULL AND abs(t.sf - sq.square_feet) > 0.10 * sq.square_feet) AS sub_mismatch,
       t.created_at
  FROM takeoffs t
  JOIN opportunities o ON o.id = t.opportunity_id
  LEFT JOIN LATERAL (
        SELECT s.square_feet, s.sub_name FROM sub_quotes s
         WHERE s.opportunity_id = t.opportunity_id AND s.square_feet > 0
           AND coalesce(s.quote_type, 'labor') <> 'material'
           AND (t.system IS NULL OR s.system IS NULL OR s.system = t.system)
         ORDER BY s.received_at DESC NULLS LAST LIMIT 1) sq ON true;

-- ── the scoreboard: how good is each method, judged against the best truth available (field, else sub) ──
CREATE OR REPLACE VIEW public.v_takeoff_method_stats WITH (security_invoker = true) AS
WITH x AS (
  SELECT method, coalesce(err_vs_field_pct, err_vs_sub_pct) AS err,
         CASE WHEN err_vs_field_pct IS NOT NULL THEN 'field' WHEN err_vs_sub_pct IS NOT NULL THEN 'sub' END AS truth,
         field_in_range
    FROM v_takeoff_accuracy)
SELECT method,
       count(*)                                                    AS takeoffs,
       count(err)                                                  AS with_truth,
       count(*) FILTER (WHERE truth = 'field')                     AS field_verified,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY abs(err))::numeric, 1) AS median_abs_err_pct,
       round(avg(err), 1)                                          AS bias_pct,
       round(100.0 * count(*) FILTER (WHERE field_in_range) / nullif(count(field_in_range), 0), 0) AS range_hit_pct
  FROM x GROUP BY method;

-- ── agent write paths (service_role only) ──
CREATE OR REPLACE FUNCTION public.agent_record_takeoff(
  p_opportunity_id uuid, p_area_label text, p_method text, p_sf numeric,
  p_sf_low numeric DEFAULT NULL, p_sf_high numeric DEFAULT NULL,
  p_system text DEFAULT NULL, p_finish_code text DEFAULT NULL, p_sheet text DEFAULT NULL, p_page int DEFAULT NULL,
  p_scale_stated_ptft numeric DEFAULT NULL, p_scale_fit_ptft numeric DEFAULT NULL, p_n_dims int DEFAULT NULL,
  p_perimeter_lf numeric DEFAULT NULL, p_cove_lf numeric DEFAULT NULL, p_cross_checks jsonb DEFAULT NULL,
  p_check_image_url text DEFAULT NULL, p_notes text DEFAULT NULL, p_estimate_id uuid DEFAULT NULL,
  p_agent text DEFAULT NULL, p_scale_override boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_err numeric;
BEGIN
  -- a measured takeoff must pass the scale gate: >= 3 dimension strings, fitted scale within 2% of stated
  IF p_method IN ('vector_grid','vector_faces','raster_grid') AND NOT p_scale_override THEN
    IF coalesce(p_n_dims, 0) < 3 OR p_scale_fit_ptft IS NULL OR p_scale_stated_ptft IS NULL THEN
      RAISE EXCEPTION 'scale gate: need >= 3 dimension strings and both stated and fitted scale (or p_scale_override with a note)';
    END IF;
    v_err := abs(p_scale_fit_ptft - p_scale_stated_ptft) / p_scale_stated_ptft * 100;
    IF v_err > 2 THEN
      RAISE EXCEPTION 'scale gate: fitted scale is % pct off the stated scale', round(v_err, 1);
    END IF;
  END IF;
  IF p_scale_override AND coalesce(length(p_notes), 0) < 10 THEN
    RAISE EXCEPTION 'scale override needs a note explaining why';
  END IF;
  IF p_method <> 'stated' AND (p_sf_low IS NULL OR p_sf_high IS NULL) THEN
    RAISE EXCEPTION 'measured SF needs a low/high range';
  END IF;
  INSERT INTO takeoffs (opportunity_id, estimate_id, area_label, finish_code, system, sheet, page, method,
                        scale_stated_ptft, scale_fit_ptft, n_dims, sf, sf_low, sf_high, perimeter_lf, cove_lf,
                        cross_checks, check_image_url, agent, notes, created_by)
  VALUES (p_opportunity_id, p_estimate_id, p_area_label, p_finish_code, p_system, p_sheet, p_page, p_method,
          p_scale_stated_ptft, p_scale_fit_ptft, p_n_dims, p_sf, p_sf_low, p_sf_high, p_perimeter_lf, p_cove_lf,
          coalesce(p_cross_checks, '[]'::jsonb), p_check_image_url, p_agent, p_notes,
          (SELECT owner_id FROM opportunities WHERE id = p_opportunity_id))
  RETURNING id INTO v_id;
  IF p_estimate_id IS NOT NULL THEN
    UPDATE estimates SET sf_source = p_method, sf_low = p_sf_low, sf_high = p_sf_high, takeoff_id = v_id
     WHERE id = p_estimate_id AND opportunity_id = p_opportunity_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.agent_add_takeoff_lesson(
  p_lesson text, p_applies_when text DEFAULT 'always', p_opportunity_id uuid DEFAULT NULL, p_takeoff_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO takeoff_lessons (lesson, applies_when, source_opportunity_id, source_takeoff_id)
  VALUES (p_lesson, coalesce(p_applies_when, 'always'), p_opportunity_id, p_takeoff_id) RETURNING id;
$$;

REVOKE ALL ON FUNCTION public.agent_record_takeoff(uuid,text,text,numeric,numeric,numeric,text,text,text,int,numeric,numeric,int,numeric,numeric,jsonb,text,text,uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_record_takeoff(uuid,text,text,numeric,numeric,numeric,text,text,text,int,numeric,numeric,int,numeric,numeric,jsonb,text,text,uuid,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.agent_add_takeoff_lesson(text,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_add_takeoff_lesson(text,text,uuid,uuid) TO service_role;

-- ── seed: D1 Training (the job that started this) ──
-- 10/20 bid scout read the finish hatch by eye: ~2,000-2,500 SF. Kept as the first data point for the eyeball method.
INSERT INTO takeoffs (opportunity_id, area_label, finish_code, system, sheet, method, sf, sf_low, sf_high, agent, notes, created_by)
SELECT '551ef5b4-3467-4afe-84de-16205edede62', 'Lobby / office / corridor', 'F-1', 'sealer', 'A111', 'eyeball',
       2250, 2000, 2500, 'bid-scout 2026-10-20',
       'Read visually from the finish hatch, no scale. Superseded by the vector_grid takeoff (679 SF).',
       (SELECT owner_id FROM opportunities WHERE id = '551ef5b4-3467-4afe-84de-16205edede62')
WHERE NOT EXISTS (SELECT 1 FROM takeoffs WHERE opportunity_id = '551ef5b4-3467-4afe-84de-16205edede62' AND method = 'eyeball');

-- 10/22 re-measure with takeoff.py: 12 dimension strings fit 17.993 pt/ft vs 18.000 stated (1/4 in = 1 ft-0 in).
INSERT INTO takeoffs (opportunity_id, estimate_id, area_label, finish_code, system, sheet, page, method,
                      scale_stated_ptft, scale_fit_ptft, n_dims, sf, sf_low, sf_high, perimeter_lf,
                      cross_checks, agent, notes, created_by)
SELECT '551ef5b4-3467-4afe-84de-16205edede62', 'd630a3f5-a5e8-4e65-b770-b40d03099136',
       'Lobby / office / corridor', 'F-1', 'sealer', 'A111', 12, 'vector_grid',
       18.000, 17.993, 12, 679, 627, 731, 205,
       '[{"source":"A100 occupancy table, BUSINESS gross area","sf":685,"diff_pct":-0.9},
         {"source":"G001 lease total","sf":5031,"note":"F-1 is 13.5 pct of the lease, turf/rubber/tile make up the rest"}]'::jsonb,
       'mcfc-takeoff 2026-10-22',
       'Net of office partitions, 1.5 ft feature wall excluded. First pass included turf left of the WP-1 wall (788 SF) - caught on the check image.',
       (SELECT owner_id FROM opportunities WHERE id = '551ef5b4-3467-4afe-84de-16205edede62')
WHERE NOT EXISTS (SELECT 1 FROM takeoffs WHERE opportunity_id = '551ef5b4-3467-4afe-84de-16205edede62' AND method = 'vector_grid');

UPDATE estimates e SET sf_source = 'vector_grid', sf_low = 627, sf_high = 731,
       takeoff_id = (SELECT id FROM takeoffs WHERE opportunity_id = e.opportunity_id AND method = 'vector_grid' LIMIT 1)
 WHERE e.id = 'd630a3f5-a5e8-4e65-b770-b40d03099136' AND e.takeoff_id IS NULL;

INSERT INTO takeoff_lessons (lesson, applies_when, source_opportunity_id)
SELECT l, w, '551ef5b4-3467-4afe-84de-16205edede62'::uuid FROM (VALUES
  ('An AI reading the finish hatch by eye is not a measurement. D1: eyeball 2,000-2,500 SF, measured 679 SF (3x high). Never price from an eyeball number.', 'always'),
  ('Before measuring, look for area-by-use tables on the life safety / occupancy plan (A100, G-series code sheets). D1 BUSINESS 685 SF matched the F-1 takeoff within 1 pct. Record it as a cross-check.', 'tenant fit-outs'),
  ('Always open the check image and look for hatch inside the yellow. D1 first pass had turf + marks inside the polygon left of the feature wall: 788 SF -> 679 SF.', 'always'),
  ('Door swing arcs are a weak scale check (D1 arcs read 19-53 in). Calibrate on written dimension strings, and use the door schedule only as a third check.', 'always'),
  ('Finish plans tag rooms by finish code, and the legend says which codes are owner-provided or existing. Out-of-scope codes are measured as zero, not skipped silently: list them in the room inventory.', 'always')
) v(l, w)
WHERE NOT EXISTS (SELECT 1 FROM takeoff_lessons);
