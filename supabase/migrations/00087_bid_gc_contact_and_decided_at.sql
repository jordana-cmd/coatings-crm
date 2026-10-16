-- 00087_bid_gc_contact_and_decided_at.sql
-- Two small additions for the bid-results chaser agent.
--
--   bids.gc_contact_id        The GC estimator the bid actually went to. bids
--                             already has gc_company_id; with no contact link,
--                             every chaser run had to search Gmail again to
--                             find who to follow up with.
--
--   opportunities.decided_at  When the opp became WON or LOST. Win-rate windows
--                             used updated_at, so any later edit (a note, an
--                             amount fix) pulled an old decision back into "last
--                             90 days". closed_loss_at (00082) only covers
--                             losses recorded through close_opportunity_loss().
--                             A trigger keeps this correct on every write path:
--                             the advance_stage RPCs, close_opportunity_loss,
--                             Cowork service-role writes, and direct updates.

-- ── bids.gc_contact_id ──────────────────────────────────────────────────────
ALTER TABLE bids
  ADD COLUMN IF NOT EXISTS gc_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bids_gc_contact ON bids (gc_contact_id);

COMMENT ON COLUMN bids.gc_contact_id IS
  'GC estimator the bid was sent to (who to chase for the result). Company stays in gc_company_id.';

-- ── opportunities.decided_at ────────────────────────────────────────────────
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

COMMENT ON COLUMN opportunities.decided_at IS
  'When status became WON or LOST. Maintained by trg_opportunities_decided_at; NULL while undecided. Use this, not updated_at, for win-rate windows.';

CREATE OR REPLACE FUNCTION public.set_opportunity_decided_at()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status IN ('WON', 'LOST') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.decided_at := coalesce(NEW.decided_at, now());
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      -- Newly decided, or flipped WON<->LOST: stamp now unless the caller
      -- explicitly supplied a different timestamp (e.g. a backdated result).
      IF NEW.decided_at IS NOT DISTINCT FROM OLD.decided_at THEN
        NEW.decided_at := now();
      END IF;
    END IF;
  ELSE
    -- Reopened (OPEN / NURTURE / DISQUALIFIED / NO_BID): no longer a decided bid.
    NEW.decided_at := NULL;
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_opportunities_decided_at ON opportunities;
CREATE TRIGGER trg_opportunities_decided_at
  BEFORE INSERT OR UPDATE OF status, decided_at ON opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_opportunity_decided_at();

-- Backfill best-known decision time for existing decided opps:
-- explicit loss close, else the stage-history row that entered the terminal
-- stage, else stage_entered_at, else updated_at / created_at.
UPDATE opportunities o SET decided_at = coalesce(
    CASE WHEN o.status = 'LOST' THEN o.closed_loss_at END,
    (SELECT max(h.changed_at) FROM opportunity_stage_history h
      WHERE h.opportunity_id = o.id AND h.to_stage IN ('WON', 'LOST', 'AWARDED')),
    CASE WHEN o.stage IN ('WON', 'LOST', 'AWARDED') THEN o.stage_entered_at END,
    o.updated_at,
    o.created_at)
WHERE o.status IN ('WON', 'LOST') AND o.decided_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_decided_at
  ON opportunities (decided_at) WHERE decided_at IS NOT NULL;
