-- 00_invariants.sql
-- Transactional test script: seeds minimal data, asserts each hard invariant,
-- then rolls back leaving the DB unchanged.
-- Run: psql <DB_URL> -f supabase/tests/00_invariants.sql

BEGIN;

-- ============================================================
-- SEED: one company + one auth user for FK satisfaction
-- ============================================================

-- Insert a minimal auth.users row (Supabase manages this table;
-- we insert directly for test purposes only).
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, instance_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test@example.com',
  '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012', -- dummy hash
  now(),
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
);

INSERT INTO companies (id, name, type, region, address)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Test GC Inc',
  'GC',
  'MI',
  '123 Main St, Detroit, MI'
);

-- ============================================================
-- TEST (a): PUBLIC_BID opp with stage 'QUOTING' -> REJECTED
-- ============================================================
DO $$
BEGIN
  INSERT INTO opportunities (name, pipeline, stage, owner_id, company_id, job_site_address)
  VALUES ('Bad Stage Test', 'PUBLIC_BID', 'QUOTING',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000010',
          '456 Job St');
  RAISE NOTICE 'FAIL (a): PUBLIC_BID with stage QUOTING was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS (a): PUBLIC_BID with stage QUOTING correctly rejected';
END;
$$;

-- ============================================================
-- TEST (b): GC_CHASE + status LOST + lost_reason NULL -> REJECTED
-- ============================================================
DO $$
BEGIN
  INSERT INTO opportunities (name, pipeline, stage, status, lost_reason, owner_id, company_id, job_site_address)
  VALUES ('Lost No Reason', 'GC_CHASE', 'LOST', 'LOST', NULL,
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000010',
          '456 Job St');
  RAISE NOTICE 'FAIL (b): GC_CHASE LOST with NULL lost_reason was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS (b): GC_CHASE LOST with NULL lost_reason correctly rejected';
END;
$$;

-- ============================================================
-- TEST (c): FACILITY + status NURTURE + revisit_date NULL -> REJECTED
-- ============================================================
DO $$
BEGIN
  INSERT INTO opportunities (name, pipeline, stage, status, revisit_date, owner_id, company_id, job_site_address)
  VALUES ('Nurture No Date', 'FACILITY', 'NURTURE', 'NURTURE', NULL,
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000010',
          '456 Job St');
  RAISE NOTICE 'FAIL (c): FACILITY NURTURE with NULL revisit_date was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS (c): FACILITY NURTURE with NULL revisit_date correctly rejected';
END;
$$;

-- ============================================================
-- TEST (d): bids row for a FACILITY opp -> REJECTED by guard trigger
-- ============================================================
DO $$
DECLARE
  v_opp_id uuid;
BEGIN
  INSERT INTO opportunities (id, name, pipeline, stage, owner_id, company_id, job_site_address)
  VALUES (gen_random_uuid(), 'Facility Opp', 'FACILITY', 'ENGAGED',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000010',
          '456 Job St')
  RETURNING id INTO v_opp_id;

  INSERT INTO bids (opportunity_id) VALUES (v_opp_id);
  RAISE NOTICE 'FAIL (d): bids row for FACILITY opp was accepted';
EXCEPTION WHEN raise_exception THEN
  RAISE NOTICE 'PASS (d): bids row for FACILITY opp correctly rejected';
END;
$$;

-- ============================================================
-- TEST (e): facility_details for a PUBLIC_BID opp -> REJECTED by guard trigger
-- ============================================================
DO $$
DECLARE
  v_opp_id uuid;
BEGIN
  INSERT INTO opportunities (id, name, pipeline, stage, owner_id, company_id, job_site_address)
  VALUES (gen_random_uuid(), 'Public Opp', 'PUBLIC_BID', 'SOURCED',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000010',
          '456 Job St')
  RETURNING id INTO v_opp_id;

  INSERT INTO facility_details (opportunity_id) VALUES (v_opp_id);
  RAISE NOTICE 'FAIL (e): facility_details for PUBLIC_BID opp was accepted';
EXCEPTION WHEN raise_exception THEN
  RAISE NOTICE 'PASS (e): facility_details for PUBLIC_BID opp correctly rejected';
END;
$$;

-- ============================================================
-- TEST (f): valid PUBLIC_BID opp + matching bids row -> SUCCEEDS
-- ============================================================
DO $$
DECLARE
  v_opp_id uuid;
BEGIN
  INSERT INTO opportunities (id, name, pipeline, stage, owner_id, company_id, job_site_address)
  VALUES (gen_random_uuid(), 'Good Public Bid', 'PUBLIC_BID', 'SOURCED',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000010',
          '789 Good St')
  RETURNING id INTO v_opp_id;

  INSERT INTO bids (opportunity_id) VALUES (v_opp_id);
  RAISE NOTICE 'PASS (f): valid PUBLIC_BID opp + bids row accepted';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL (f): valid PUBLIC_BID opp + bids row rejected unexpectedly: %', SQLERRM;
END;
$$;

-- ============================================================
-- ROLLBACK: leave DB unchanged
-- ============================================================
ROLLBACK;
