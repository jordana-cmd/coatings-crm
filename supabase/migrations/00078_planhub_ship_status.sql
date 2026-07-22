-- 00078_planhub_ship_status.sql
-- The Imports screen needs a "pending folders in crm-inbox" count, but the
-- browser can't read the local folder. The ship-step (ship_to_crm.py) is the
-- only thing that sees crm-inbox, so it reports each run's summary here and the
-- screen reads the latest row. "What came in and when" comes from planhub_details.

CREATE TABLE planhub_ship_status (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at         timestamptz NOT NULL DEFAULT now(),
  folders_found  integer NOT NULL DEFAULT 0,   -- completed folders (deal.json present)
  created        integer NOT NULL DEFAULT 0,
  updated        integer NOT NULL DEFAULT 0,
  skipped        integer NOT NULL DEFAULT 0,
  failed         integer NOT NULL DEFAULT 0,   -- left in crm-inbox = pending, to re-ship
  errors         jsonb                          -- [{folder, detail}] for the failures
);

CREATE INDEX idx_planhub_ship_status_ran_at ON planhub_ship_status (ran_at DESC);

ALTER TABLE planhub_ship_status ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can read the ship status.
CREATE POLICY planhub_ship_status_read ON planhub_ship_status
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Writes come only from the import Edge Function (service_role bypasses RLS).
GRANT SELECT ON planhub_ship_status TO authenticated;
GRANT INSERT ON planhub_ship_status TO service_role;

-- ── Rollback (forward-only repo): DROP TABLE IF EXISTS planhub_ship_status; ──
