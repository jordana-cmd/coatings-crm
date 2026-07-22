-- 00077_planhub_import.sql — PlanHub deal ingest.
-- Extension table (mirrors federal_details) + transactional import RPC + idempotency indexes.
-- Deals land as GC_CHASE / QUALIFIED (the new entry stage from 00076).

CREATE TABLE planhub_details (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id         uuid NOT NULL UNIQUE REFERENCES opportunities(id) ON DELETE CASCADE,
  planhub_id             text NOT NULL,
  revision               integer NOT NULL DEFAULT 1,
  planhub_url            text,
  source                 text,
  verdict                text CHECK (verdict IN ('BID','CALL')),
  fit                    text,
  distance_miles         numeric,
  square_feet            numeric,
  project_value_usd      numeric,
  labor                  text,
  construction_type      text,
  project_type           text,
  building_use           text,
  short_name             text,
  why                    text,
  flooring_scope_summary text,
  planhub_created_at     date,
  imported_at            timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz
);

CREATE UNIQUE INDEX idx_planhub_details_planhub_id ON planhub_details (planhub_id);

-- Extension only on GC_CHASE opps (mirrors trg_guard_federal_pipeline).
CREATE OR REPLACE FUNCTION trg_guard_planhub_pipeline() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE p pipeline_type;
BEGIN
  SELECT pipeline INTO p FROM opportunities WHERE id = NEW.opportunity_id;
  IF p <> 'GC_CHASE' THEN
    RAISE EXCEPTION 'planhub_details requires GC_CHASE, got %', p;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER planhub_pipeline_guard BEFORE INSERT ON planhub_details
  FOR EACH ROW EXECUTE FUNCTION trg_guard_planhub_pipeline();

-- RLS (mirrors federal_details / bid_quotes). service_role bypasses RLS.
ALTER TABLE planhub_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY planhub_rep_all ON planhub_details FOR ALL
  USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = planhub_details.opportunity_id AND o.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = planhub_details.opportunity_id AND o.owner_id = auth.uid()));
CREATE POLICY planhub_owner_select ON planhub_details FOR SELECT USING (current_app_role() = 'owner');
CREATE POLICY planhub_admin_all ON planhub_details FOR ALL
  USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');
GRANT SELECT, INSERT, UPDATE, DELETE ON planhub_details TO authenticated;

-- Idempotent document re-attach (deterministic storage path, re-POST safe).
CREATE UNIQUE INDEX idx_opp_docs_unique_path ON opportunity_documents (opportunity_id, storage_path);

-- GC company upsert key on email (verified: no existing dup non-null emails).
CREATE UNIQUE INDEX idx_companies_email_unique ON companies (lower(email)) WHERE email IS NOT NULL AND btrim(email) <> '';

-- ── Transactional ingest: opportunity + bids + planhub_details + GC company/contact + task ──
-- Dedup on planhub_id; revision gate (new→insert, higher→update, ≤→skip). All-or-nothing.
CREATE OR REPLACE FUNCTION import_planhub_deal(payload jsonb, p_owner_id uuid)
RETURNS TABLE(status text, opportunity_id uuid, revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  d jsonb := payload->'deal';  g jsonb := payload->'gc';  t jsonb := d->'task';
  v_pid text := d->>'planhub_id';
  v_rev int  := coalesce((payload->>'revision')::int, 1);
  v_existing_opp uuid;  v_existing_rev int;  v_is_new boolean;
  v_opp uuid;  v_company uuid;
  v_email text := nullif(btrim(g->>'email'), '');
  v_addr  text;  v_pw boolean;  v_value numeric;  v_sf numeric;  v_task_type activity_type;
BEGIN
  IF coalesce((payload->>'schema_version')::int, 0) <> 1 THEN
    RAISE EXCEPTION 'unsupported schema_version: %', payload->>'schema_version';
  END IF;
  IF v_pid IS NULL OR btrim(v_pid) = '' THEN RAISE EXCEPTION 'deal.planhub_id is required'; END IF;
  IF coalesce(nullif(btrim(d->>'project_name'), ''), '') = '' THEN RAISE EXCEPTION 'deal.project_name is required'; END IF;

  SELECT pd.opportunity_id, pd.revision INTO v_existing_opp, v_existing_rev
    FROM planhub_details pd WHERE pd.planhub_id = v_pid;
  v_is_new := (v_existing_opp IS NULL);

  IF NOT v_is_new AND v_rev <= v_existing_rev THEN
    RETURN QUERY SELECT 'skipped'::text, v_existing_opp, v_existing_rev; RETURN;
  END IF;

  v_addr := coalesce(nullif(concat_ws(', ',
              nullif(btrim(d->>'address'), ''), nullif(btrim(d->>'city'), ''), nullif(btrim(d->>'state'), '')
            ), ''), 'See PlanHub listing');
  v_pw   := CASE d->>'labor' WHEN 'prevailing_wage' THEN true WHEN 'open_shop' THEN false ELSE NULL END;
  v_value := nullif((d->>'value_usd')::numeric, 1);      -- $1 placeholder → null (defensive; writer already nulls)
  v_sf    := nullif((d->>'square_feet')::numeric, 1);
  v_task_type := CASE t->>'type' WHEN 'call' THEN 'CALL'::activity_type ELSE 'NOTE'::activity_type END;

  -- GC company: find-or-create on email, keep phone.
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_company FROM companies WHERE lower(email) = lower(v_email) LIMIT 1;
  END IF;
  IF v_company IS NULL THEN
    INSERT INTO companies (name, type, region, address, phone, email)
    VALUES (coalesce(nullif(btrim(g->>'company'), ''), 'Unknown GC'), 'GC',
            coalesce(nullif(btrim(d->>'state'), ''), 'MI'),
            coalesce(nullif(btrim(d->>'address'), ''), 'See PlanHub listing'),
            nullif(btrim(g->>'phone'), ''), v_email)
    RETURNING id INTO v_company;
  ELSE
    UPDATE companies SET phone = coalesce(nullif(btrim(g->>'phone'), ''), phone) WHERE id = v_company;
  END IF;

  -- GC contact: create on email within company if absent (phone is NOT NULL).
  IF v_email IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM contacts WHERE company_id = v_company AND lower(email) = lower(v_email)) THEN
    INSERT INTO contacts (company_id, name, role, phone, email)
    VALUES (v_company, coalesce(nullif(btrim(g->>'contact_name'), ''), 'GC Contact'),
            'PM', coalesce(nullif(btrim(g->>'phone'), ''), ''), v_email);
  END IF;

  IF v_is_new THEN
    INSERT INTO opportunities (name, pipeline, stage, status, owner_id, company_id,
                               job_site_address, amount, prevailing_wage, project_tag)
    VALUES (d->>'project_name', 'GC_CHASE', 'QUALIFIED', 'OPEN', p_owner_id, v_company,
            v_addr, NULL, v_pw, 'PlanHub')          -- amount stays NULL: no bid yet (value → project_value_usd)
    RETURNING id INTO v_opp;

    INSERT INTO bids (opportunity_id, bid_due_at) VALUES (v_opp, (d->>'bid_due')::timestamptz);

    INSERT INTO planhub_details (opportunity_id, planhub_id, revision, planhub_url, source, verdict, fit,
      distance_miles, square_feet, project_value_usd, labor, construction_type, project_type, building_use,
      short_name, why, flooring_scope_summary, planhub_created_at)
    VALUES (v_opp, v_pid, v_rev, d->>'planhub_url', payload->>'source', d->>'verdict', d->>'fit',
      (d->>'distance_miles')::numeric, v_sf, v_value, d->>'labor', d->>'construction_type', d->>'project_type',
      d->>'building_use', d->>'short_name', d->>'why', d->>'flooring_scope_summary', (payload->>'created_at')::date);

    INSERT INTO activities (opportunity_id, user_id, type, note, next_action, next_action_at, logged_at)
    SELECT v_opp, p_owner_id, v_task_type, t->>'title', t->>'title', (t->>'due')::date, now()
    WHERE nullif(btrim(t->>'title'), '') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM activities a WHERE a.opportunity_id = v_opp AND a.next_action = t->>'title');

    RETURN QUERY SELECT 'created'::text, v_opp, v_rev; RETURN;

  ELSE
    v_opp := v_existing_opp;
    UPDATE opportunities SET name = d->>'project_name', job_site_address = v_addr,
           prevailing_wage = v_pw, company_id = v_company, updated_at = now()
     WHERE id = v_opp;                               -- amount untouched: preserve any bid entered since import
    UPDATE bids SET bid_due_at = (d->>'bid_due')::timestamptz WHERE bids.opportunity_id = v_opp;
    UPDATE planhub_details SET revision = v_rev, planhub_url = d->>'planhub_url', verdict = d->>'verdict',
           fit = d->>'fit', distance_miles = (d->>'distance_miles')::numeric, square_feet = v_sf,
           project_value_usd = v_value, labor = d->>'labor', construction_type = d->>'construction_type',
           project_type = d->>'project_type', building_use = d->>'building_use', short_name = d->>'short_name',
           why = d->>'why', flooring_scope_summary = d->>'flooring_scope_summary', updated_at = now()
     WHERE planhub_details.opportunity_id = v_opp;

    RETURN QUERY SELECT 'updated'::text, v_opp, v_rev; RETURN;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION import_planhub_deal(jsonb, uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run manually; forward-only repo):
--   DROP FUNCTION IF EXISTS import_planhub_deal(jsonb, uuid);
--   DROP INDEX IF EXISTS idx_companies_email_unique;
--   DROP INDEX IF EXISTS idx_opp_docs_unique_path;
--   DROP TABLE IF EXISTS planhub_details;              -- indexes/policies/trigger drop with it
--   DROP FUNCTION IF EXISTS trg_guard_planhub_pipeline();
-- ─────────────────────────────────────────────────────────────────────────────
