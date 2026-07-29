-- 00081_opp_status_no_bid.sql
-- Adds NO_BID to the opp_status enum for Bid/No-Bid triage from the dashboard.
--
-- WHY ITS OWN MIGRATION: Postgres forbids *using* an enum value in the same
-- transaction that added it. Supabase runs one transaction per migration file,
-- so the value has to land here and be consumed by 00082 to stay safe.
--
-- WHY THE ENUM AND NOT A no_bid BOOLEAN: status is already the single
-- "is this deal still live" switch — every dashboard view and query filters
-- status = 'OPEN' (v_outstanding_bid_dollars, v_bond_exposure,
-- v_bid_out_awaiting, the cadence touch list). A NO_BID value drops a
-- no-bid deal out of all of them for free; a parallel boolean would need
-- every one of those predicates hand-edited. Win rate reads
-- status IN ('WON','LOST'), so a no-bid correctly does NOT count as a loss.

ALTER TYPE opp_status ADD VALUE IF NOT EXISTS 'NO_BID';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run manually; forward-only repo).
-- Postgres cannot DROP an enum value. To reverse:
--   1. UPDATE opportunities SET status = 'OPEN' WHERE status = 'NO_BID';
--   2. Rebuild the type:
--      ALTER TYPE opp_status RENAME TO opp_status_old;
--      CREATE TYPE opp_status AS ENUM ('OPEN','WON','LOST','NURTURE','DISQUALIFIED');
--      ALTER TABLE opportunities ALTER COLUMN status TYPE opp_status
--        USING status::text::opp_status;
--      -- then re-create every function/view whose signature names opp_status
--      -- (advance_stage, close_opportunity_loss, set_opportunity_no_bid), and
--      DROP TYPE opp_status_old;
-- ─────────────────────────────────────────────────────────────────────────────
