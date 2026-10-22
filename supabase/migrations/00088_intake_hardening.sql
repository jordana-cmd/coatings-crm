-- 00088_intake_hardening.sql
-- Hardening for the nightly gmail-pdf-intake agent (MCFC Brain). Additive only.
--
--   processed_messages    durable idempotency state (replaces Gmail labels as the source of truth)
--   intake_decisions      every classify/match decision with confidence + evidence (review queue)
--   proposals             structured proposal register (replaces parsing 'Pipeline: proposal ...' notes)
--   opportunity_aliases   learned names for jobs ("Alabama job" -> VA Tuscaloosa)
--   opportunities.duplicate_of      soft-merge pointer for duplicate jobs (never delete)
--   sub_quotes.quote_type/line_items/estimate_number/source_message_id   labor vs material
--   v_price_points        excludes material-only quotes from $/SF history
--   find_similar_opportunities()    trigram + alias + initials dedupe check
--   agent_* RPCs          the ONLY write path the intake agent uses (service_role only)
--   cowork_create_opportunity_checked()   dedupe-first wrapper over cowork_create_opportunity
--   REVOKE                cowork_create_opportunity / cowork_log_activity / import_planhub_deal took an
--                         explicit owner and were executable by anon + authenticated. Server-only now.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ── opportunities.duplicate_of ──
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES opportunities(id);
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_duplicate_not_self;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_duplicate_not_self CHECK (duplicate_of IS NULL OR duplicate_of <> id);

-- ── sub_quotes: labor vs material ──
ALTER TABLE sub_quotes ADD COLUMN IF NOT EXISTS quote_type text NOT NULL DEFAULT 'labor';
ALTER TABLE sub_quotes DROP CONSTRAINT IF EXISTS sub_quotes_quote_type_check;
ALTER TABLE sub_quotes ADD CONSTRAINT sub_quotes_quote_type_check
  CHECK (quote_type IN ('labor', 'material', 'labor_and_material'));
ALTER TABLE sub_quotes ADD COLUMN IF NOT EXISTS line_items jsonb;          -- [{desc, qty, unit, unit_price, extended}]
ALTER TABLE sub_quotes ADD COLUMN IF NOT EXISTS estimate_number text;      -- MSC "ESTIMATE #", supplier quote no.
ALTER TABLE sub_quotes ADD COLUMN IF NOT EXISTS source_message_id text;    -- Gmail message id it came from

-- ── opportunity_aliases ──
CREATE TABLE IF NOT EXISTS opportunity_aliases (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  alias           text        NOT NULL CHECK (btrim(alias) <> ''),
  source          text        NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'review', 'agent')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_opportunity_aliases ON opportunity_aliases (opportunity_id, lower(btrim(alias)));

-- ── agent run linkage (decisions / processed rows reference a run) ──
-- ── intake_decisions ──
CREATE TABLE IF NOT EXISTS intake_decisions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                  uuid        REFERENCES agent_runs(id),
  gmail_message_id        text        NOT NULL,
  attachment_sha256       text        NOT NULL DEFAULT '',
  filename                text,
  direction               text        NOT NULL DEFAULT 'IN' CHECK (direction IN ('IN', 'OUT')),
  sender                  text,
  doc_type                text        NOT NULL CHECK (doc_type IN
                            ('SUB_QUOTE', 'MATERIAL_QUOTE', 'BID_DOC', 'ADDENDUM', 'PROPOSAL',
                             'CONTRACT_DOC', 'NOT_BID', 'OTHER')),
  opportunity_id          uuid        REFERENCES opportunities(id),
  confidence              numeric     NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence                jsonb       NOT NULL DEFAULT '[]'::jsonb,   -- ["thread: 'our Alabama job'", "PDF: 'Tuscaloosa AL'"]
  extracted               jsonb,                                       -- amount, estimate_number, sf, system, ...
  reasoning               text,
  status                  text        NOT NULL CHECK (status IN ('AUTO', 'NEEDS_REVIEW', 'SKIPPED', 'CONFIRMED', 'CORRECTED', 'IGNORED')),
  reviewed_opportunity_id uuid        REFERENCES opportunities(id),
  reviewed_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intake_decisions_status ON intake_decisions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_decisions_msg ON intake_decisions (gmail_message_id);

-- ── processed_messages ──
CREATE TABLE IF NOT EXISTS processed_messages (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id   text        NOT NULL,
  attachment_sha256  text        NOT NULL DEFAULT '',     -- '' = message-level row (no PDF / skipped whole message)
  filename           text,
  direction          text        NOT NULL DEFAULT 'IN' CHECK (direction IN ('IN', 'OUT')),
  outcome            text        NOT NULL CHECK (outcome IN
                       ('FILED', 'PROPOSAL_FILED', 'DUPLICATE_FILE', 'NEEDS_MATCH', 'SKIPPED_NOT_BID',
                        'SKIPPED_INTERNAL', 'TOO_LARGE', 'ERROR')),
  opportunity_id     uuid        REFERENCES opportunities(id),
  drive_path         text,
  decision_id        uuid        REFERENCES intake_decisions(id),
  run_id             uuid        REFERENCES agent_runs(id),
  detail             text,
  processed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gmail_message_id, attachment_sha256)
);
CREATE INDEX IF NOT EXISTS idx_processed_messages_sha ON processed_messages (attachment_sha256) WHERE attachment_sha256 <> '';

-- ── proposals ──
CREATE TABLE IF NOT EXISTS proposals (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id         uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  proposal_number        text,                                -- 'MCFC-2026-1194', '0148'; null = no number
  version                integer     NOT NULL DEFAULT 1 CHECK (version > 0),
  amount                 numeric     CHECK (amount IS NULL OR amount > 0),
  alternates             jsonb,                               -- [{label, amount}]
  estimate_id            uuid        REFERENCES estimates(id),
  gmail_draft_id         text,
  gmail_sent_message_id  text        UNIQUE,
  status                 text        NOT NULL DEFAULT 'DRAFTED' CHECK (status IN ('DRAFTED', 'SENT', 'SUPERSEDED', 'ABANDONED')),
  sent_at                timestamptz,
  recipient_email        text,
  drive_path             text,
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_proposals_number_version ON proposals (proposal_number, version) WHERE proposal_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_opp ON proposals (opportunity_id);

-- ── RLS (mirrors 00086: admin all, owner read, rep via own opportunity) ──
ALTER TABLE opportunity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_decisions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals           ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['opportunity_aliases', 'intake_decisions', 'processed_messages', 'proposals'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %1$s_admin_all ON %1$s', t);
    EXECUTE format('CREATE POLICY %1$s_admin_all ON %1$s FOR ALL USING (current_app_role() = ''admin'') WITH CHECK (current_app_role() = ''admin'')', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_owner_select ON %1$s', t);
    EXECUTE format('CREATE POLICY %1$s_owner_select ON %1$s FOR SELECT USING (current_app_role() = ''owner'')', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS opportunity_aliases_rep_all ON opportunity_aliases;
CREATE POLICY opportunity_aliases_rep_all ON opportunity_aliases FOR ALL
  USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_aliases.opportunity_id AND o.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_aliases.opportunity_id AND o.owner_id = auth.uid()));

DROP POLICY IF EXISTS proposals_rep_all ON proposals;
CREATE POLICY proposals_rep_all ON proposals FOR ALL
  USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = proposals.opportunity_id AND o.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = proposals.opportunity_id AND o.owner_id = auth.uid()));

-- ── v_price_points: material-only quotes are not installed $/SF ──
CREATE OR REPLACE VIEW v_price_points WITH (security_invoker = true) AS
  SELECT 'MCFC_ESTIMATE'::text           AS source,
         e.opportunity_id,
         o.name                          AS opportunity_name,
         o.pipeline,
         o.status                        AS opportunity_status,
         'MotorCity Floors and Coatings' AS party,
         e.system,
         e.square_feet,
         coalesce(e.approved_price, e.recommended_price) AS amount,
         e.price_per_sf,
         e.created_at::date              AS observed_on
    FROM estimates e
    JOIN opportunities o ON o.id = e.opportunity_id
   WHERE e.status <> 'SUPERSEDED'
  UNION ALL
  SELECT 'SUB_QUOTE', s.opportunity_id, o.name, o.pipeline, o.status,
         s.sub_name, s.system, s.square_feet, s.amount, s.price_per_sf,
         coalesce(s.received_at, s.created_at::date)
    FROM sub_quotes s
    JOIN opportunities o ON o.id = s.opportunity_id
   WHERE s.quote_type <> 'material'
  UNION ALL
  SELECT CASE WHEN c.is_winner THEN 'WINNING_BID' ELSE 'COMPETITOR_BID' END,
         c.opportunity_id, o.name, o.pipeline, o.status,
         c.bidder_name, NULL::text, NULL::numeric, c.amount, NULL::numeric,
         c.created_at::date
    FROM competitor_bids c
    JOIN opportunities o ON o.id = c.opportunity_id;

-- ── dedupe ──
CREATE OR REPLACE FUNCTION public.norm_opp_name(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT btrim(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

-- Match key: normalized name minus generic construction/location words and numbers, so
-- "Center Renovation" or "MI" don't make unrelated jobs look alike. Tuned on the 10/22 job list.
CREATE OR REPLACE FUNCTION public.opp_match_key(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT btrim(regexp_replace(regexp_replace(norm_opp_name(p),
    '\m(renovations?|improvements?|interior|building|bldg|center|centre|project|new|the|and|of|mi|oh|il|in|nc|tx|nh|epoxy|flooring|floors?|polish|job|reno|remodel|expansion|addition|buildout|re|bid|\d+)\M',
    ' ', 'g'), '\s+', ' ', 'g'));
$$;

-- true when a 2–5 letter token of p_in equals the initials of 2–5 consecutive words of p_cand
-- ("scs pool house" vs "st clair shores pool house" -> true)
CREATE OR REPLACE FUNCTION public.opp_initials_hit(p_in text, p_cand text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE
  w text[] := regexp_split_to_array(norm_opp_name(p_cand), ' ');
  tok text; n int; i int; ini text;
BEGIN
  FOREACH tok IN ARRAY regexp_split_to_array(norm_opp_name(p_in), ' ') LOOP
    CONTINUE WHEN length(tok) NOT BETWEEN 2 AND 5 OR tok !~ '^[a-z]+$';
    n := length(tok);
    FOR i IN 1 .. coalesce(array_length(w, 1), 0) - n + 1 LOOP
      SELECT string_agg(left(x, 1), '' ORDER BY ord) INTO ini
        FROM unnest(w[i:i + n - 1]) WITH ORDINALITY AS u(x, ord);
      IF ini = tok THEN RETURN true; END IF;
    END LOOP;
  END LOOP;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.find_similar_opportunities(
  p_name text, p_min numeric DEFAULT 0.45, p_limit int DEFAULT 5, p_exclude uuid DEFAULT NULL
) RETURNS TABLE(opportunity_id uuid, name text, status opp_status, stage text, score numeric, matched_on text)
LANGUAGE sql STABLE SET search_path TO 'public', 'extensions' AS $$
  WITH c AS (
    SELECT o.id, o.name, o.status, o.stage, 'name'::text AS via, o.name AS txt
      FROM opportunities o WHERE o.duplicate_of IS NULL
    UNION ALL
    SELECT o.id, o.name, o.status, o.stage, 'alias', a.alias
      FROM opportunity_aliases a JOIN opportunities o ON o.id = a.opportunity_id WHERE o.duplicate_of IS NULL
  ), s AS (
    SELECT c.id, c.name, c.status, c.stage, c.via,
           least(1, (similarity(opp_match_key(p_name), opp_match_key(c.txt))
                     + word_similarity(opp_match_key(p_name), opp_match_key(c.txt))) / 2
                    + CASE WHEN opp_initials_hit(p_name, c.txt) THEN 0.25 ELSE 0 END)::numeric AS sc
      FROM c
     WHERE p_exclude IS NULL OR c.id <> p_exclude
  )
  SELECT DISTINCT ON (s.id) s.id, s.name, s.status, s.stage, round(s.sc, 2), s.via
    FROM s WHERE s.sc >= p_min
   ORDER BY s.id, s.sc DESC
$$;
-- (callers sort by score; DISTINCT ON keeps the best hit per opportunity)

CREATE OR REPLACE FUNCTION public.find_similar_opportunities_ranked(
  p_name text, p_min numeric DEFAULT 0.45, p_limit int DEFAULT 5, p_exclude uuid DEFAULT NULL
) RETURNS TABLE(opportunity_id uuid, name text, status opp_status, stage text, score numeric, matched_on text)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT * FROM find_similar_opportunities(p_name, p_min, p_limit, p_exclude) f
   ORDER BY f.score DESC LIMIT p_limit
$$;

-- Dedupe-first create for agents. Returns status 'similar' + the best match instead of creating,
-- unless p_allow_duplicate. Otherwise delegates to cowork_create_opportunity unchanged.
CREATE OR REPLACE FUNCTION public.cowork_create_opportunity_checked(
  p_owner uuid, p_name text, p_pipeline pipeline_type, p_job_site_address text,
  p_amount numeric DEFAULT NULL, p_company_id uuid DEFAULT NULL, p_company_name text DEFAULT NULL,
  p_company_type company_type DEFAULT NULL, p_company_email text DEFAULT NULL,
  p_company_region text DEFAULT NULL, p_company_address text DEFAULT NULL,
  p_solicitation_number text DEFAULT NULL, p_allow_duplicate boolean DEFAULT false
) RETURNS TABLE(status text, opportunity_id uuid, company_id uuid, similar jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_sim jsonb; r record;
BEGIN
  IF NOT p_allow_duplicate THEN
    SELECT jsonb_agg(jsonb_build_object('opportunity_id', f.opportunity_id, 'name', f.name,
                                        'status', f.status, 'score', f.score, 'matched_on', f.matched_on))
      INTO v_sim FROM find_similar_opportunities_ranked(p_name, 0.55, 5) f;
    IF v_sim IS NOT NULL THEN
      RETURN QUERY SELECT 'similar'::text, (v_sim -> 0 ->> 'opportunity_id')::uuid, NULL::uuid, v_sim;
      RETURN;
    END IF;
  END IF;
  SELECT * INTO r FROM cowork_create_opportunity(p_owner, p_name, p_pipeline, p_job_site_address, p_amount,
    p_company_id, p_company_name, p_company_type, p_company_email, p_company_region, p_company_address,
    p_solicitation_number);
  RETURN QUERY SELECT r.status, r.opportunity_id, r.company_id, NULL::jsonb;
END $$;

-- ── agent RPCs (service_role only) ──

CREATE OR REPLACE FUNCTION public.agent_start_run(p_agent text) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO agent_runs (agent, status) VALUES (p_agent, 'RUNNING') RETURNING id;
$$;

CREATE OR REPLACE FUNCTION public.agent_finish_run(
  p_run uuid, p_status text, p_summary text, p_items jsonb DEFAULT NULL, p_errors jsonb DEFAULT NULL, p_log_url text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_status NOT IN ('SUCCEEDED', 'PARTIAL', 'FAILED') THEN RAISE EXCEPTION 'bad status %', p_status; END IF;
  UPDATE agent_runs SET finished_at = now(), status = p_status, summary = p_summary,
         items = p_items, errors = p_errors, log_url = coalesce(p_log_url, log_url)
   WHERE id = p_run AND status = 'RUNNING';
  IF NOT FOUND THEN RAISE EXCEPTION 'run % not found or already finished', p_run; END IF;
END $$;

-- Gmail search lower bound: start of the last successful run minus 1 day of overlap
-- (processed_messages makes the overlap free). Falls back to 3 days ago.
CREATE OR REPLACE FUNCTION public.agent_intake_since(p_agent text DEFAULT 'gmail-pdf-intake') RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(
    (SELECT (max(started_at) - interval '1 day')::date FROM agent_runs
      WHERE agent = p_agent AND status IN ('SUCCEEDED', 'PARTIAL')),
    (now() - interval '3 days')::date);
$$;

-- Records one decision; the DATABASE applies the confidence threshold, not the prompt.
-- Returns the decision id and the action the agent is allowed to take ('FILE' | 'REVIEW' | 'SKIP').
CREATE OR REPLACE FUNCTION public.agent_record_decision(
  p_run uuid, p_message_id text, p_sha text, p_filename text, p_direction text, p_sender text,
  p_doc_type text, p_opportunity_id uuid, p_confidence numeric, p_evidence jsonb,
  p_extracted jsonb DEFAULT NULL, p_reasoning text DEFAULT NULL
) RETURNS TABLE(decision_id uuid, action text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status text; v_action text; v_id uuid; v_dup uuid;
BEGIN
  IF p_opportunity_id IS NOT NULL THEN
    SELECT duplicate_of INTO v_dup FROM opportunities WHERE id = p_opportunity_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'opportunity % does not exist', p_opportunity_id; END IF;
    IF v_dup IS NOT NULL THEN RAISE EXCEPTION 'opportunity % is a duplicate of %; match that one', p_opportunity_id, v_dup; END IF;
  END IF;
  IF p_doc_type = 'NOT_BID' THEN
    v_status := 'SKIPPED'; v_action := 'SKIP';
  ELSIF p_opportunity_id IS NOT NULL AND p_confidence >= 0.85 AND jsonb_array_length(coalesce(p_evidence, '[]')) > 0 THEN
    v_status := 'AUTO'; v_action := 'FILE';
  ELSE
    v_status := 'NEEDS_REVIEW'; v_action := 'REVIEW';
  END IF;
  INSERT INTO intake_decisions (run_id, gmail_message_id, attachment_sha256, filename, direction, sender,
         doc_type, opportunity_id, confidence, evidence, extracted, reasoning, status)
  VALUES (p_run, p_message_id, coalesce(p_sha, ''), p_filename, coalesce(p_direction, 'IN'), p_sender,
         p_doc_type, p_opportunity_id, p_confidence, coalesce(p_evidence, '[]'), p_extracted, p_reasoning, v_status)
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, v_action;
END $$;

-- Idempotency write. Returns false when the row already existed (caller must not re-file).
CREATE OR REPLACE FUNCTION public.agent_mark_processed(
  p_run uuid, p_message_id text, p_sha text, p_filename text, p_direction text, p_outcome text,
  p_opportunity_id uuid DEFAULT NULL, p_drive_path text DEFAULT NULL, p_decision uuid DEFAULT NULL, p_detail text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO processed_messages (run_id, gmail_message_id, attachment_sha256, filename, direction, outcome,
         opportunity_id, drive_path, decision_id, detail)
  VALUES (p_run, p_message_id, coalesce(p_sha, ''), p_filename, coalesce(p_direction, 'IN'), p_outcome,
         p_opportunity_id, p_drive_path, p_decision, p_detail)
  ON CONFLICT (gmail_message_id, attachment_sha256) DO NOTHING;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.agent_log_sub_quote(
  p_owner uuid, p_opportunity_id uuid, p_sub_name text, p_amount numeric, p_quote_type text, p_system text,
  p_square_feet numeric, p_scope_notes text, p_received_at date, p_estimate_number text,
  p_line_items jsonb DEFAULT NULL, p_source_message_id text DEFAULT NULL
) RETURNS TABLE(sub_quote_id uuid, inserted boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_company uuid; v_url text; v_id uuid;
BEGIN
  IF p_system IS NOT NULL AND p_system NOT IN ('flake','epoxy','sealer','polish','quartz','urethane_cement','esd','other') THEN
    RAISE EXCEPTION 'bad system %', p_system;
  END IF;
  SELECT drive_folder_url INTO v_url FROM opportunities WHERE id = p_opportunity_id AND duplicate_of IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'opportunity % missing or a duplicate', p_opportunity_id; END IF;
  SELECT id INTO v_company FROM companies
   WHERE lower(name) = lower(btrim(p_sub_name)) OR (lower(btrim(p_sub_name)) = 'msc floors' AND name ILIKE 'MSC Floors%')
   ORDER BY (type = 'SUBCONTRACTOR') DESC LIMIT 1;
  INSERT INTO sub_quotes (opportunity_id, sub_company_id, sub_name, amount, quote_type, system, square_feet,
         scope_notes, received_at, file_url, created_by, estimate_number, line_items, source_message_id)
  VALUES (p_opportunity_id, v_company, btrim(p_sub_name), p_amount, p_quote_type, p_system, p_square_feet,
         p_scope_notes, p_received_at, v_url, p_owner, p_estimate_number, p_line_items, p_source_message_id)
  ON CONFLICT (opportunity_id, sub_name, amount) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM sub_quotes WHERE opportunity_id = p_opportunity_id AND sub_name = btrim(p_sub_name) AND amount = p_amount;
    RETURN QUERY SELECT v_id, false;
  ELSE
    RETURN QUERY SELECT v_id, true;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.agent_note(p_owner uuid, p_opportunity_id uuid, p_note text) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO activities (opportunity_id, user_id, type, note, logged_at)
  VALUES (p_opportunity_id, p_owner, 'NOTE', p_note, now()) RETURNING id;
$$;

CREATE OR REPLACE FUNCTION public.agent_set_drive_folder(p_opportunity_id uuid, p_url text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_url !~ '^https://drive\.google\.com/drive/folders/[A-Za-z0-9_-]+$' THEN RAISE EXCEPTION 'bad folder url'; END IF;
  UPDATE opportunities SET drive_folder_url = p_url WHERE id = p_opportunity_id AND drive_folder_url IS NULL;
  RETURN FOUND;
END $$;

-- Registers a proposal (drafted or sent). Upserts on (number, version).
CREATE OR REPLACE FUNCTION public.agent_record_proposal(
  p_opportunity_id uuid, p_number text, p_amount numeric, p_status text,
  p_sent_at timestamptz DEFAULT NULL, p_recipient text DEFAULT NULL, p_sent_message_id text DEFAULT NULL,
  p_draft_id text DEFAULT NULL, p_drive_path text DEFAULT NULL, p_estimate_id uuid DEFAULT NULL,
  p_alternates jsonb DEFAULT NULL, p_version int DEFAULT 1
) RETURNS TABLE(proposal_id uuid, number_conflict uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_other uuid;
BEGIN
  -- same number already used on a DIFFERENT job = flag, don't write
  SELECT opportunity_id INTO v_other FROM proposals
   WHERE proposal_number = p_number AND opportunity_id <> p_opportunity_id LIMIT 1;
  IF v_other IS NOT NULL THEN RETURN QUERY SELECT NULL::uuid, v_other; RETURN; END IF;

  SELECT id INTO v_id FROM proposals
   WHERE (p_sent_message_id IS NOT NULL AND gmail_sent_message_id = p_sent_message_id)
      OR (p_number IS NOT NULL AND proposal_number = p_number AND version = p_version)
   LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO proposals (opportunity_id, proposal_number, version, amount, status, sent_at, recipient_email,
           gmail_sent_message_id, gmail_draft_id, drive_path, estimate_id, alternates)
    VALUES (p_opportunity_id, p_number, p_version, p_amount, p_status, p_sent_at, p_recipient,
           p_sent_message_id, p_draft_id, p_drive_path, p_estimate_id, p_alternates)
    RETURNING id INTO v_id;
  ELSE
    UPDATE proposals SET amount = coalesce(p_amount, amount), status = p_status,
           sent_at = coalesce(p_sent_at, sent_at), recipient_email = coalesce(p_recipient, recipient_email),
           gmail_sent_message_id = coalesce(p_sent_message_id, gmail_sent_message_id),
           gmail_draft_id = coalesce(p_draft_id, gmail_draft_id), drive_path = coalesce(p_drive_path, drive_path),
           estimate_id = coalesce(p_estimate_id, estimate_id), alternates = coalesce(p_alternates, alternates),
           updated_at = now()
     WHERE id = v_id;
  END IF;
  RETURN QUERY SELECT v_id, NULL::uuid;
END $$;

-- Deterministic "proposal sent" handler: bids flags, amount, stage walk via the gated RPC, activity note.
-- Walks one stage at a time; stops at the first gate error and returns it (never writes stage by hand).
CREATE OR REPLACE FUNCTION public.agent_mark_submitted(
  p_owner uuid, p_opportunity_id uuid, p_amount numeric, p_sent_date date, p_number text, p_recipient text
) RETURNS TABLE(old_stage text, new_stage text, error text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  o record; path text[]; i int; j int; cur text; v_err text;
BEGIN
  SELECT * INTO o FROM opportunities WHERE id = p_opportunity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'opportunity % not found', p_opportunity_id; END IF;
  IF o.status <> 'OPEN' THEN RETURN QUERY SELECT o.stage, o.stage, 'status is ' || o.status || ', not OPEN — left alone'; RETURN; END IF;

  path := CASE o.pipeline
    WHEN 'GC_CHASE'   THEN ARRAY['QUALIFIED','BIDDING','ESTIMATED','SUBMITTED']
    WHEN 'PUBLIC_BID' THEN ARRAY['SOURCED','BIDDING','ESTIMATED','SUBMITTED']
    WHEN 'FACILITY'   THEN ARRAY['ENGAGED','SITE_WALK','PROPOSAL','APPROVAL']
    WHEN 'FEDERAL'    THEN ARRAY['INTAKE','EXTRACTION','SCORING','ESTIMATING','SUBMITTED']
  END;
  IF o.pipeline IN ('PUBLIC_BID', 'GC_CHASE') THEN
    UPDATE bids SET quote_delivered = true, gc_bid_date = coalesce(gc_bid_date, p_sent_date::timestamptz)
     WHERE opportunity_id = p_opportunity_id;
  END IF;
  IF p_amount IS NOT NULL AND p_amount > 0 THEN
    UPDATE opportunities SET amount = p_amount, updated_at = now() WHERE id = p_opportunity_id;
  END IF;

  i := array_position(path, o.stage);
  cur := o.stage;
  IF i IS NOT NULL THEN
    FOR j IN i + 1 .. array_length(path, 1) LOOP
      BEGIN
        PERFORM 1 FROM cowork_advance_stage(p_owner, p_opportunity_id, path[j]);
        cur := path[j];
      EXCEPTION WHEN OTHERS THEN
        v_err := SQLERRM; EXIT;
      END;
    END LOOP;
  END IF;   -- stage not on the path = already past it (GC_AWARDED, WON, ...): no stage change

  INSERT INTO activities (opportunity_id, user_id, type, note, logged_at)
  VALUES (p_opportunity_id, p_owner, 'NOTE',
          format('Intake: proposal filed %s $%s sent %s to %s — stage %s -> %s%s',
                 coalesce(p_number, 'NoNum'), coalesce(to_char(p_amount, 'FM999,999,990.00'), '?'),
                 p_sent_date, coalesce(p_recipient, '?'), o.stage, cur,
                 CASE WHEN v_err IS NOT NULL THEN ' (stopped: ' || v_err || ')' ELSE '' END),
          now());
  RETURN QUERY SELECT o.stage, cur, v_err;
END $$;

-- Human review: confirm / correct / ignore a decision; a correction can teach an alias.
CREATE OR REPLACE FUNCTION public.agent_resolve_decision(
  p_decision uuid, p_status text, p_opportunity_id uuid DEFAULT NULL, p_alias text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d record;
BEGIN
  IF p_status NOT IN ('CONFIRMED', 'CORRECTED', 'IGNORED') THEN RAISE EXCEPTION 'bad status %', p_status; END IF;
  SELECT * INTO d FROM intake_decisions WHERE id = p_decision;
  IF NOT FOUND THEN RAISE EXCEPTION 'decision % not found', p_decision; END IF;
  UPDATE intake_decisions SET status = p_status, reviewed_at = now(),
         reviewed_opportunity_id = coalesce(p_opportunity_id, d.opportunity_id)
   WHERE id = p_decision;
  IF p_alias IS NOT NULL AND coalesce(p_opportunity_id, d.opportunity_id) IS NOT NULL THEN
    INSERT INTO opportunity_aliases (opportunity_id, alias, source)
    VALUES (coalesce(p_opportunity_id, d.opportunity_id), p_alias, 'review')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ── grants: agent/server functions are service_role only ──
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'cowork_create_opportunity(uuid,text,pipeline_type,text,numeric,uuid,text,company_type,text,text,text,text)',
    'cowork_log_activity(uuid,uuid,activity_type,text,text,date)',
    'import_planhub_deal(jsonb,uuid)',
    'cowork_create_opportunity_checked(uuid,text,pipeline_type,text,numeric,uuid,text,company_type,text,text,text,text,boolean)',
    'agent_start_run(text)',
    'agent_finish_run(uuid,text,text,jsonb,jsonb,text)',
    'agent_intake_since(text)',
    'agent_record_decision(uuid,text,text,text,text,text,text,uuid,numeric,jsonb,jsonb,text)',
    'agent_mark_processed(uuid,text,text,text,text,text,uuid,text,uuid,text)',
    'agent_log_sub_quote(uuid,uuid,text,numeric,text,text,numeric,text,date,text,jsonb,text)',
    'agent_note(uuid,uuid,text)',
    'agent_set_drive_folder(uuid,text)',
    'agent_record_proposal(uuid,text,numeric,text,timestamptz,text,text,text,text,uuid,jsonb,int)',
    'agent_mark_submitted(uuid,uuid,numeric,date,text,text)',
    'agent_resolve_decision(uuid,text,uuid,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

-- dedupe lookups are safe for signed-in users (SECURITY INVOKER: RLS applies)
REVOKE ALL ON FUNCTION public.find_similar_opportunities(text,numeric,int,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_similar_opportunities_ranked(text,numeric,int,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_similar_opportunities(text,numeric,int,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_similar_opportunities_ranked(text,numeric,int,uuid) TO authenticated, service_role;

-- ── keep proposals in sync with the Bid Pipeline agent without changing its prompt ──
-- Bid Pipeline logs 'Pipeline: proposal MCFC-YYYY-NNNN $X ... [estimate:<uuid> draft:<id>]'.
-- This trigger turns that note into a DRAFTED proposals row. Errors never block the activity insert.
CREATE OR REPLACE FUNCTION public.trg_activity_pipeline_proposal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.note LIKE 'Pipeline: proposal MCFC-%' THEN
    INSERT INTO proposals (opportunity_id, proposal_number, amount, estimate_id, gmail_draft_id, status, notes, created_at)
    VALUES (NEW.opportunity_id,
            substring(NEW.note from 'proposal (MCFC-[0-9]{4}-[0-9]+(-R[0-9]+)?)'),
            nullif(replace(substring(NEW.note from '[$]([0-9,]+[.][0-9]{2})'), ',', ''), '')::numeric,
            substring(NEW.note from 'estimate:([0-9a-f-]{36})')::uuid,
            substring(NEW.note from 'draft:(r-?[0-9]+)'),
            'DRAFTED', 'From Bid Pipeline activity note', NEW.logged_at)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS activity_pipeline_proposal ON activities;
CREATE TRIGGER activity_pipeline_proposal AFTER INSERT ON activities
  FOR EACH ROW EXECUTE FUNCTION trg_activity_pipeline_proposal();

-- NOTE (2026-10-22): applied to production through the Supabase MCP execute_sql tool in small
-- chunks (apply_migration and large multi-statement payloads timed out; DO blocks containing
-- quoted literals hang that tool). Policies and grants were issued as explicit statements with the
-- same effect as the DO loops above. Recorded as version 00088 in supabase_migrations.schema_migrations.
-- Data backfill done the same night (not part of this file): duplicate_of for Mad Museum and
-- SCS Pool House, 4 aliases, Sherwin quote -> material, estimate_number parsed from scope_notes,
-- 'MSC' -> 'MSC Floors', 5 DRAFTED proposals from Pipeline notes, processed_messages for the 10/22 run.
REVOKE ALL ON FUNCTION public.trg_activity_pipeline_proposal() FROM PUBLIC, anon, authenticated;
