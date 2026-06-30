-- 00060_seed_pellston_rfp.sql
-- Pellston Public Schools RFP: company + contact + opportunity + note + calendar activity.
-- Idempotent. Owner_id = first auth.users row (single-user MVP).
-- Company type = 'OWNER' (renamed from PLANT_OWNER in 00054).
-- Contact role = 'PM' (nearest match for school superintendent; no GOV role exists).

-- ============================================================
-- STEP 1: COMPANY
-- ============================================================
INSERT INTO companies (name, type, region, address, phone, website, city, state)
SELECT 'Pellston Public Schools', 'OWNER', 'MI',
       '172 Park Street, Pellston, MI 49769', '(231) 539-8421',
       'https://www.pellstonschools.org', 'Pellston', 'MI'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Pellston Public Schools');

-- ============================================================
-- STEP 2: CONTACT
-- ============================================================
INSERT INTO contacts (name, company_id, role, phone, email, title, is_decision_maker, city, state)
SELECT 'Stephen Seelye', c.id, 'PM', '(231) 539-8421',
       'sseelye@pellstonschools.org', 'Superintendent',
       true, 'Pellston', 'MI'
FROM companies c
WHERE c.name = 'Pellston Public Schools'
  AND NOT EXISTS (
    SELECT 1 FROM contacts
    WHERE name = 'Stephen Seelye' AND company_id = c.id
  );

-- ============================================================
-- STEP 3: OPPORTUNITY + bids extension + stage history + note
-- STEP 4: CALENDAR activity
-- ============================================================
DO $$
DECLARE
  v_opp_id     uuid;
  v_company_id uuid;
  v_contact_id uuid;
  v_owner_id   uuid;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE name = 'Pellston Public Schools';
  SELECT id INTO v_contact_id FROM contacts WHERE name = 'Stephen Seelye' AND company_id = v_company_id;
  SELECT id INTO v_owner_id   FROM auth.users LIMIT 1;

  -- Guard: skip if opportunity already exists
  IF EXISTS (
    SELECT 1 FROM opportunities
    WHERE name = 'Pellston Public Schools - Carpet Removal & Epoxy Flooring (Middle/High School)'
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
    'Pellston Public Schools - Carpet Removal & Epoxy Flooring (Middle/High School)',
    'PUBLIC_BID', 'SOURCED', 'OPEN', 197240, v_owner_id, v_company_id,
    'Pellston, MI', '2026-07-01',
    'Submit sealed proposal by 2:30 PM', '2026-07-01'
  );

  -- Bids extension row (required: bids iff PUBLIC_BID)
  -- Set bid_due_at to Jul 1 2026 2:30 PM ET (approximate)
  INSERT INTO bids (opportunity_id, bid_due_at, bond_required, bond_amount)
  VALUES (v_opp_id, '2026-07-01T18:30:00Z', true, 9862);

  -- Stage history (initial stage)
  INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_by)
  VALUES (v_opp_id, NULL, 'SOURCED', v_owner_id);

  -- NOTE activity: full RFP details
  INSERT INTO activities (opportunity_id, user_id, contact_id, type, note)
  VALUES (
    v_opp_id, v_owner_id, v_contact_id, 'NOTE',
    E'RFP \u2014 2026 Pellston Public Schools Carpet Demolition / Epoxy Coating Project\n'
    || E'Owner: Pellston Public School District (172 Park Street, Pellston, MI 49769)\n'
    || E'Scope: Remove existing hallway carpet, cove base, and adhesive (chemical or approved shot-blast prep) at Pellston Middle/High School; install new epoxy flooring finish \u2014 Sherwin-Williams Resuflor Topcoat Metallic II system (~27 mil), cove base throughout corridors, per Schedule C/D specs. Carpet hauled off to approved landfill/recycling. Floor plans (1st + 2nd floor) define areas.\n'
    || E'Bid amount (our proposal): $197,240\n'
    || E'Key dates: Pre-bid walk Jun 23, 2026 2:30 PM (non-mandatory, PASSED). Proposals due Wed July 1, 2026 2:30 PM local \u2014 late = returned unopened. Bid holds 60 days (base) / 90 days (alternates).\n'
    || E'Submission: 1 original + 1 copy, sealed, marked with firm name + project, to Office of the Superintendent; EMAIL submissions also accepted by the District Rep.\n'
    || E'BONDING (amount > $50k): 5% bid bond required WITH proposal (~$9,862); Performance & Payment bonds required if awarded; include bond cost in base price.\n'
    || E'Required forms: Schedule A Bid Form + Iran Business Relationship Affidavit + Familial Disclosure Statement (notarized) \u2014 district will NOT accept a bid missing the notarized familial disclosure.\n'
    || E'Insurance: CGL $2M agg, auto $1M, umbrella $2M, WC statutory, employer liability $500k; Owner named additional insured; products-completed ops maintained 1 yr after final payment.\n'
    || E'POC / District Representative: Stephen Seelye, Superintendent \u2014 sseelye@pellstonschools.org, (231) 539-8421. NOTE: RFP shows name as both "Seelye" and "Seeyle" (used Seelye per body/email); phone shown as both 231.539.8421 and 231.593.8421 (used 539 \u2014 VERIFY).\n'
    || E'Do NOT contact Board members re: this RFP before award (auto-disqualifier per 3.4).\n'
    || E'Source: RFP PDF (in Documents); also at www.pellstonschools.org and MI SIGMA site.'
  );

  -- CALENDAR activity: bid due date on calendar via next_action_at
  INSERT INTO activities (opportunity_id, user_id, contact_id, type, note, next_action, next_action_at)
  VALUES (
    v_opp_id, v_owner_id, v_contact_id, 'NOTE',
    'BID DUE 2:30 PM — Pellston Schools Carpet/Epoxy (sealed + bond). Due at Office of the Superintendent. Needs: bid bond ($9,862) + notarized familial disclosure + Iran affidavit. https://www.pellstonschools.org',
    'BID DUE 2:30 PM — Pellston Schools Carpet/Epoxy (sealed + bond)',
    '2026-07-01'
  );
END $$;
