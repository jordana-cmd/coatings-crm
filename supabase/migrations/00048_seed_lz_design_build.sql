-- 00048_seed_lz_design_build.sql
-- Seed LZ Design Build Group: 1 company + 4 contacts with direct phones + emails. Idempotent.
-- No owner_id on companies/contacts (shared reference data).
-- Contact phone = each contact's direct line (NOT the company main line).
-- Contact email = direct email in contacts.email column.

-- ============================================================
-- COMPANY (1)
-- ============================================================
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'LZ Design Build Group', 'GC', 'IL', 'Roselle, IL', '(808) 690-7689', 'https://www.lzdesignbuild.com', 'Roselle', 'IL' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'LZ Design Build Group');

-- ============================================================
-- CONTACTS (4)
-- ============================================================
INSERT INTO contacts (name, company_id, role, phone, email, is_decision_maker, city, state) SELECT 'Damian Poleszuk', c.id, 'PM', '(773) 443-1835', 'dpoleszuk@lzdesignbuild.com', false, 'Roselle', 'IL' FROM companies c WHERE c.name='LZ Design Build Group' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Damian Poleszuk' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, email, is_decision_maker, city, state) SELECT 'Frank Lesny-Zborek', c.id, 'PM', '(808) 690-7689', 'flesnyzborek@lzdesignbuild.com', false, 'Roselle', 'IL' FROM companies c WHERE c.name='LZ Design Build Group' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Frank Lesny-Zborek' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, email, is_decision_maker, city, state) SELECT 'Peter Zbork', c.id, 'PM', '(773) 617-8371', 'flesnyzbork@lzdesignbuild.com', false, 'Roselle', 'IL' FROM companies c WHERE c.name='LZ Design Build Group' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Peter Zbork' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, email, is_decision_maker, city, state) SELECT 'Sam Stevens', c.id, 'PM', '(847) 774-7142', 'sstevens@lzdesignbuild.com', false, 'Roselle', 'IL' FROM companies c WHERE c.name='LZ Design Build Group' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Sam Stevens' AND company_id=c.id);
