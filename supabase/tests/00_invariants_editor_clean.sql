CREATE TEMP TABLE IF NOT EXISTS results (
  "case"   text,
  result   text,
  detail   text
);

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'invariant-test@example.com',
  '$2a$10$zzzzzzzzzzzzzzzzzzzzzuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  now(), now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO companies (id, name, type, region, address)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Test GC Inc', 'GC', 'MI', '123 Main St, Detroit, MI'
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  INSERT INTO opportunities (name, pipeline, stage, owner_id, company_id, job_site_address)
  VALUES ('Bad Stage', 'PUBLIC_BID', 'QUOTING',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000010',
          '456 Job St');
  INSERT INTO results VALUES ('a', 'FAIL', 'PUBLIC_BID with stage QUOTING was accepted');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('a', 'PASS', 'PUBLIC_BID with stage QUOTING correctly rejected');
END;
$$;

DO $$
BEGIN
  INSERT INTO opportunities (name, pipeline, stage, status, lost_reason, owner_id, company_id, job_site_address)
  VALUES ('Lost No Reason', 'GC_CHASE', 'LOST', 'LOST', NULL,
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000010',
          '456 Job St');
  INSERT INTO results VALUES ('b', 'FAIL', 'GC_CHASE LOST with NULL lost_reason was accepted');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('b', 'PASS', 'GC_CHASE LOST with NULL lost_reason correctly rejected');
END;
$$;

DO $$
BEGIN
  INSERT INTO opportunities (name, pipeline, stage, status, revisit_date, owner_id, company_id, job_site_address)
  VALUES ('Nurture No Date', 'FACILITY', 'NURTURE', 'NURTURE', NULL,
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000010',
          '456 Job St');
  INSERT INTO results VALUES ('c', 'FAIL', 'FACILITY NURTURE with NULL revisit_date was accepted');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('c', 'PASS', 'FACILITY NURTURE with NULL revisit_date correctly rejected');
END;
$$;

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
  INSERT INTO results VALUES ('d', 'FAIL', 'bids row for FACILITY opp was accepted');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('d', 'PASS', 'bids row for FACILITY opp correctly rejected');
END;
$$;

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
  INSERT INTO results VALUES ('e', 'FAIL', 'facility_details for PUBLIC_BID opp was accepted');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('e', 'PASS', 'facility_details for PUBLIC_BID opp correctly rejected');
END;
$$;

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
  INSERT INTO results VALUES ('f', 'PASS', 'valid PUBLIC_BID opp + bids row accepted');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('f', 'FAIL', 'valid PUBLIC_BID opp + bids row rejected: ' || SQLERRM);
END;
$$;

SELECT * FROM results ORDER BY "case";

DELETE FROM bids WHERE opportunity_id IN (
  SELECT id FROM opportunities WHERE owner_id = '00000000-0000-0000-0000-000000000001'
);
DELETE FROM facility_details WHERE opportunity_id IN (
  SELECT id FROM opportunities WHERE owner_id = '00000000-0000-0000-0000-000000000001'
);
DELETE FROM opportunities WHERE owner_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM companies WHERE id = '00000000-0000-0000-0000-000000000010';
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000001';
