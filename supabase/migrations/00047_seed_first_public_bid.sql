-- 00047_seed_first_public_bid.sql
-- First real PUBLIC_BID opportunity: SAM.gov presolicitation W912WJ26QA127
-- USACE - New England District (AWARDING_AUTHORITY) + Contract Specialist contact + opp + note + calendar activity.
-- Idempotent: skips each row if it already exists.
-- Owner_id: first user in auth.users (single-user MVP).

-- ============================================================
-- STEP 1: COMPANY (the contracting agency)
-- ============================================================
INSERT INTO companies (name, type, region, address, phone, website, city, state)
SELECT 'USACE - New England District', 'AWARDING_AUTHORITY', 'MA',
       '696 Virginia Road, Concord, MA 01742', '(978) 318-8902',
       'https://sam.gov', 'Concord', 'MA'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'USACE - New England District');

-- ============================================================
-- STEP 2: CONTACT (the contracting specialist)
-- ============================================================
INSERT INTO contacts (name, company_id, role, phone, email, title, is_decision_maker, city, state)
SELECT 'Alicia LaCrosse', c.id, 'PURCHASING', '(978) 318-8902',
       'alicia.n.lacrosse@usace.army.mil', 'Contract Specialist',
       true, 'Concord', 'MA'
FROM companies c
WHERE c.name = 'USACE - New England District'
  AND NOT EXISTS (
    SELECT 1 FROM contacts
    WHERE name = 'Alicia LaCrosse' AND company_id = c.id
  );

-- ============================================================
-- STEP 3: OPPORTUNITY + bids extension + stage history
-- STEP 4: NOTE activity + CALENDAR activity
-- ============================================================
DO $$
DECLARE
  v_opp_id     uuid;
  v_company_id uuid;
  v_contact_id uuid;
  v_owner_id   uuid;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE name = 'USACE - New England District';
  SELECT id INTO v_contact_id FROM contacts WHERE name = 'Alicia LaCrosse' AND company_id = v_company_id;
  SELECT id INTO v_owner_id   FROM auth.users LIMIT 1;

  -- Guard: skip if opportunity already exists
  IF EXISTS (
    SELECT 1 FROM opportunities
    WHERE name = 'Epoxy Floor Coating - CRREL Cold Clean Lab, Hanover NH'
      AND company_id = v_company_id
  ) THEN
    RETURN;
  END IF;

  v_opp_id := gen_random_uuid();

  -- Opportunity row (replicates create_opportunity RPC logic)
  INSERT INTO opportunities (
    id, name, pipeline, stage, status, amount, owner_id, company_id,
    job_site_address, expected_close_date, next_step, next_step_date
  ) VALUES (
    v_opp_id,
    'Epoxy Floor Coating - CRREL Cold Clean Lab, Hanover NH',
    'PUBLIC_BID', 'SOURCED', 'OPEN', 62500, v_owner_id, v_company_id,
    'Hanover, NH', '2026-07-18',
    'Solicitation documents expected to post on SAM.gov', '2026-07-18'
  );

  -- Bids extension row (required: bids iff PUBLIC_BID)
  INSERT INTO bids (opportunity_id) VALUES (v_opp_id);

  -- Stage history (initial stage)
  INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_by)
  VALUES (v_opp_id, NULL, 'SOURCED', v_owner_id);

  -- NOTE activity: full SAM.gov presolicitation details
  INSERT INTO activities (opportunity_id, user_id, contact_id, type, note)
  VALUES (
    v_opp_id, v_owner_id, v_contact_id, 'NOTE',
    E'SAM.gov Presolicitation \u2014 Notice ID W912WJ26QA127\n'
    || E'Agency: US Army Corps of Engineers, New England District (DoD / Dept of the Army)\n'
    || E'Title: Epoxy Floor Coating, Cold Regions Research and Engineering Laboratory (CRREL), Hanover, NH\n'
    || E'Type: Presolicitation (not yet a request for quotes)\n'
    || E'Set-aside: Total Small Business Set-Aside (FAR 19.5)\n'
    || E'NAICS: 238330 Flooring Contractors (size standard $19M) | PSC: Y1QA Construction/Restoration of Real Property\n'
    || E'Magnitude of construction: $25,000 \u2013 $100,000\n'
    || E'Scope: Furnish all labor, materials, equipment to provide a polyaspartic epoxy floor coating on 7 rooms of the CRREL Cold Clean Laboratory, per Statement of Work \u2014 (a) mechanical prep of concrete substrate per mfr recommendations, (b) application of polyaspartic floor coating system per mfr recommendations.\n'
    || E'Place of performance: Hanover, NH\n'
    || E'Key dates: Published Jun 23, 2026; Solicitation docs expected ~July 18, 2026; Notice inactive Jul 24, 2026.\n'
    || E'Requirements: Active SAM.gov registration required at time of submission or rejected as non-responsive. Solicitation will be online only at SAM.gov.\n'
    || E'POC: Alicia LaCrosse, Contract Specialist \u2014 alicia.n.lacrosse@usace.army.mil, (978) 318-8902\n'
    || E'Contracting office: KO Contracting Division, 696 Virginia Road, Concord, MA 01742\n'
    || E'Source: https://sam.gov (Notice ID W912WJ26QA127)'
  );

  -- CALENDAR activity: solicitation drop date on calendar via next_action_at
  INSERT INTO activities (opportunity_id, user_id, contact_id, type, note, next_action, next_action_at)
  VALUES (
    v_opp_id, v_owner_id, v_contact_id, 'NOTE',
    'Solicitation posts — Epoxy Floor Coating CRREL (SAM.gov W912WJ26QA127). Check https://sam.gov for Notice ID W912WJ26QA127.',
    'Solicitation posts — Epoxy Floor Coating CRREL (SAM.gov W912WJ26QA127)',
    '2026-07-18'
  );
END $$;
