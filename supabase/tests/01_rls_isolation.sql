CREATE TEMP TABLE IF NOT EXISTS results (
  "case"   text,
  result   text,
  detail   text
);
GRANT ALL ON TABLE results TO authenticated;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rep-a@test.com',
   '$2a$10$zzzzzzzzzzzzzzzzzzzzzuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
   now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rep-b@test.com',
   '$2a$10$zzzzzzzzzzzzzzzzzzzzzuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
   now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_profiles (id, role, full_name) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'rep', 'Rep A'),
  ('00000000-0000-0000-0000-0000000000b1', 'rep', 'Rep B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO companies (id, name, type, region, address) VALUES
  ('00000000-0000-0000-0000-000000000020', 'Seed GC', 'GC', 'MI', '100 Main St')
ON CONFLICT (id) DO NOTHING;

INSERT INTO opportunities (id, name, pipeline, stage, owner_id, company_id, job_site_address) VALUES
  ('00000000-0000-0000-0000-00000000a100', 'Opp A', 'PUBLIC_BID', 'SOURCED',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000020', '1 Alpha St'),
  ('00000000-0000-0000-0000-00000000b100', 'Opp B', 'PUBLIC_BID', 'SOURCED',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000020', '2 Bravo St')
ON CONFLICT (id) DO NOTHING;

INSERT INTO bids (id, opportunity_id) VALUES
  ('00000000-0000-0000-0000-00000000a200', '00000000-0000-0000-0000-00000000a100'),
  ('00000000-0000-0000-0000-00000000b200', '00000000-0000-0000-0000-00000000b100')
ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-0000000000a1',
    'role', 'authenticated'
  )::text, true);
SET ROLE authenticated;

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM opportunities
  WHERE owner_id = '00000000-0000-0000-0000-0000000000b1';
  IF v_count = 0 THEN
    INSERT INTO results VALUES ('a', 'PASS', 'rep_A cannot see rep_B opps');
  ELSE
    INSERT INTO results VALUES ('a', 'FAIL', 'rep_A saw ' || v_count || ' of rep_B opps');
  END IF;
END;
$$;

DO $$
DECLARE
  v_count int;
BEGIN
  UPDATE opportunities SET name = 'hacked'
  WHERE id = '00000000-0000-0000-0000-00000000b100';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    INSERT INTO results VALUES ('b', 'PASS', 'rep_A update on rep_B opp affected 0 rows');
  ELSE
    INSERT INTO results VALUES ('b', 'FAIL', 'rep_A updated ' || v_count || ' of rep_B rows');
  END IF;
END;
$$;

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM bids
  WHERE opportunity_id = '00000000-0000-0000-0000-00000000b100';
  IF v_count = 0 THEN
    INSERT INTO results VALUES ('c', 'PASS', 'rep_A cannot see rep_B bids');
  ELSE
    INSERT INTO results VALUES ('c', 'FAIL', 'rep_A saw ' || v_count || ' of rep_B bids');
  END IF;
END;
$$;

DO $$
BEGIN
  INSERT INTO companies (id, name, type, region, address)
  VALUES ('00000000-0000-0000-0000-000000000099', 'Rep Added Co', 'GC', 'OH', '1 Field St');
  INSERT INTO results VALUES ('d', 'PASS', 'rep_A inserted a company');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('d', 'FAIL', 'rep_A blocked from inserting company: ' || SQLERRM);
END;
$$;

DO $$
BEGIN
  INSERT INTO activities (id, opportunity_id, user_id, type, note)
  VALUES ('00000000-0000-0000-0000-0000000000e1',
          '00000000-0000-0000-0000-00000000a100',
          '00000000-0000-0000-0000-0000000000a1',
          'CALL', 'test call on own opp');
  INSERT INTO results VALUES ('e', 'PASS', 'rep_A logged activity on own opp');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('e', 'FAIL', 'rep_A blocked from own-opp activity: ' || SQLERRM);
END;
$$;

DO $$
BEGIN
  INSERT INTO activities (id, opportunity_id, user_id, type, note)
  VALUES (gen_random_uuid(),
          '00000000-0000-0000-0000-00000000b100',
          '00000000-0000-0000-0000-0000000000a1',
          'CALL', 'should not succeed');
  INSERT INTO results VALUES ('f', 'FAIL', 'rep_A inserted activity on rep_B opp');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('f', 'PASS', 'rep_A blocked from rep_B opp activity');
END;
$$;

RESET ROLE;

SELECT * FROM results ORDER BY "case";

DELETE FROM activities WHERE id = '00000000-0000-0000-0000-0000000000e1';
DELETE FROM bids WHERE id IN ('00000000-0000-0000-0000-00000000a200','00000000-0000-0000-0000-00000000b200');
DELETE FROM opportunities WHERE id IN ('00000000-0000-0000-0000-00000000a100','00000000-0000-0000-0000-00000000b100');
DELETE FROM companies WHERE id IN ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000099');
DELETE FROM user_profiles WHERE id IN ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1');
DELETE FROM auth.users WHERE id IN ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1');
