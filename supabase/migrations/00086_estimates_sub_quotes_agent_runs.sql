-- 00086_estimates_sub_quotes_agent_runs.sql
-- Pricing + agent layer for the MCFC Brain workflow.
--
--   estimates      one row per pricing run on an opportunity (the mcfc-pricing skill
--                  writes here). Versioned; never overwritten.
--   sub_quotes     what subcontractors (MSC and others) quoted MCFC on a job — the
--                  raw data for the sub network and price-to-win.
--   agent_runs     audit trail of scheduled agents (Bid Scout, etc.).
--   opportunities.drive_folder_url   link to the job folder in Drive (01 Active Bids/...).
--   company_type   gains SUBCONTRACTOR so subs live in companies like GCs do.
--   v_price_points one $/SF history across our estimates, sub quotes and winning
--                  competitor bids.
--
-- RLS mirrors bid_quotes (00025) / competitor_bids (00075): admin all, owner read,
-- rep full CRUD where the parent opportunity is theirs. agent_runs has no opportunity
-- parent: admin all, owner read.

ALTER TYPE company_type ADD VALUE IF NOT EXISTS 'SUBCONTRACTOR';

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS drive_folder_url text;

-- ── estimates ──
CREATE TABLE estimates (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id      uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  version             integer     NOT NULL DEFAULT 1 CHECK (version > 0),
  system              text        NOT NULL,            -- flake | epoxy | sealer | polish | quartz | urethane_cement | esd | other
  area_label          text,                            -- e.g. 'Kitchen', 'Restrooms'; null = whole job
  square_feet         numeric     CHECK (square_feet IS NULL OR square_feet > 0),
  cove_lf             numeric     CHECK (cove_lf IS NULL OR cove_lf >= 0),
  crew                numeric     CHECK (crew IS NULL OR crew > 0),
  hours_per_man       numeric     CHECK (hours_per_man IS NULL OR hours_per_man > 0),
  man_hours           numeric     CHECK (man_hours IS NULL OR man_hours > 0),
  material_cost       numeric,
  labor_cost          numeric,
  overhead_cost       numeric,
  extras_cost         numeric,
  total_cost          numeric,
  tier_prices         jsonb,                           -- [{profit_setting, price, price_per_sf, gross_margin}, ...]
  recommended_price   numeric,
  approved_price      numeric,                         -- set only when Jordan approves
  price_per_sf        numeric GENERATED ALWAYS AS (
                        CASE WHEN square_feet > 0 THEN coalesce(approved_price, recommended_price) / square_feet END
                      ) STORED,
  cost_set            text        NOT NULL DEFAULT 'current',  -- current | pm60
  status              text        NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'INCOMPLETE', 'APPROVED', 'SUPERSEDED')),
  flags               jsonb,                           -- ["Urethane cement cost missing", ...]
  pricing_sheet_url   text,
  source              text        NOT NULL DEFAULT 'manual',   -- manual | mcfc-pricing | bid-scout
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid        REFERENCES auth.users(id) DEFAULT auth.uid(),

  UNIQUE (opportunity_id, version, area_label)
);

CREATE INDEX idx_estimates_opp ON estimates (opportunity_id);
CREATE INDEX idx_estimates_system ON estimates (system);

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY estimates_admin_all ON estimates
  FOR ALL USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');

CREATE POLICY estimates_owner_select ON estimates
  FOR SELECT USING (current_app_role() = 'owner');

CREATE POLICY estimates_rep_all ON estimates
  FOR ALL
  USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = estimates.opportunity_id AND o.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = estimates.opportunity_id AND o.owner_id = auth.uid()));

-- ── sub_quotes ──
-- sub_company_id is optional so a quote can be logged before the sub exists in
-- companies; sub_name always carries the display name.
CREATE TABLE sub_quotes (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id      uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  sub_company_id      uuid        REFERENCES companies(id),
  sub_name            text        NOT NULL CHECK (btrim(sub_name) <> ''),
  amount              numeric     NOT NULL CHECK (amount > 0),
  system              text,
  square_feet         numeric     CHECK (square_feet IS NULL OR square_feet > 0),
  price_per_sf        numeric GENERATED ALWAYS AS (
                        CASE WHEN square_feet > 0 THEN amount / square_feet END
                      ) STORED,
  scope_notes         text,
  received_at         date,
  file_url            text,
  is_selected         boolean     NOT NULL DEFAULT false,   -- the sub quote MCFC carried in its bid
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid        REFERENCES auth.users(id) DEFAULT auth.uid(),

  UNIQUE (opportunity_id, sub_name, amount)
);

CREATE INDEX idx_sub_quotes_opp ON sub_quotes (opportunity_id);
CREATE INDEX idx_sub_quotes_sub ON sub_quotes (sub_company_id);

ALTER TABLE sub_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY sub_quotes_admin_all ON sub_quotes
  FOR ALL USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');

CREATE POLICY sub_quotes_owner_select ON sub_quotes
  FOR SELECT USING (current_app_role() = 'owner');

CREATE POLICY sub_quotes_rep_all ON sub_quotes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = sub_quotes.opportunity_id AND o.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = sub_quotes.opportunity_id AND o.owner_id = auth.uid()));

-- ── agent_runs ──
CREATE TABLE agent_runs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent         text        NOT NULL,                  -- 'bid-scout', 'mcfc-pricing', ...
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text        NOT NULL DEFAULT 'RUNNING'
                  CHECK (status IN ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED')),
  summary       text,
  items         jsonb,                                 -- per-project verdicts, writes, events
  errors        jsonb,
  log_url       text                                   -- Drive run log in 09 Agent Logs
);

CREATE INDEX idx_agent_runs_agent_started ON agent_runs (agent, started_at DESC);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_runs_admin_all ON agent_runs
  FOR ALL USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');

CREATE POLICY agent_runs_owner_select ON agent_runs
  FOR SELECT USING (current_app_role() = 'owner');

-- ── v_price_points ──
-- One row per price observation with $/SF where square footage is known.
-- security_invoker so the caller's RLS on the underlying tables applies.
CREATE VIEW v_price_points WITH (security_invoker = true) AS
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
  UNION ALL
  SELECT CASE WHEN c.is_winner THEN 'WINNING_BID' ELSE 'COMPETITOR_BID' END,
         c.opportunity_id, o.name, o.pipeline, o.status,
         c.bidder_name, NULL::text, NULL::numeric, c.amount, NULL::numeric,
         c.created_at::date
    FROM competitor_bids c
    JOIN opportunities o ON o.id = c.opportunity_id;
