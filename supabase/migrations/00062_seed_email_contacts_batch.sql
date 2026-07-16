-- 00062_seed_email_contacts_batch.sql
-- Seed 5 Metro-Detroit companies + 7 contacts (from email fragments). Idempotent.
-- No owner_id on companies/contacts (shared reference data).
-- Contacts with unknown last names stored as first-name-only (single `name` column).
-- Titles NULL where unknown — not fabricated. LinkedIn NULL for all (not yet researched).
-- Email set for all contacts. Phone = company main line (Elijah has ext).

-- ============================================================
-- COMPANIES (5 new — 1 Owner, 4 GC)
-- ============================================================
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'Alrig USA', 'OWNER', 'MI', 'Bingham Farms, MI', '(248) 646-9999', 'https://www.alrigusa.com', 'Bingham Farms', 'MI' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Alrig USA');
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'Acme Enterprises', 'GC', 'MI', 'Roseville, MI', '(586) 771-4800', 'https://www.acme-enterprises.com', 'Roseville', 'MI' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Acme Enterprises');
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'Venator Contracting Group', 'GC', 'MI', 'Clinton Township, MI', '(586) 229-2428', 'https://www.venatorcontracting.com', 'Clinton Township', 'MI' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Venator Contracting Group');
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'J.G. Morris Jr.', 'GC', 'MI', 'Grosse Ile, MI', '(734) 362-7600', 'https://www.jgmorrisjr.com', 'Grosse Ile', 'MI' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'J.G. Morris Jr.');
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'Life Construction & Design', 'GC', 'MI', 'Troy, MI', '(248) 765-9037', 'https://www.lifeconstruction.us', 'Troy', 'MI' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Life Construction & Design');

-- ============================================================
-- CONTACTS (7 — linked via company-name subquery)
-- ============================================================

-- Acme Enterprises (1)
INSERT INTO contacts (name, company_id, role, phone, email, title, is_decision_maker, linkedin_url, city, state) SELECT 'Elijah Small', c.id, 'ESTIMATOR', '(586) 771-4800 ext.1010', 'esmall@acme-enterprises.com', 'Estimator', false, NULL, 'Roseville', 'MI' FROM companies c WHERE c.name='Acme Enterprises' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Elijah Small' AND company_id=c.id);

-- Alrig USA (3)
INSERT INTO contacts (name, company_id, role, phone, email, title, is_decision_maker, linkedin_url, city, state) SELECT 'Alexandra Abela', c.id, 'PM', '(248) 646-9999', 'alexandra@alrigusa.com', NULL, false, NULL, 'Bingham Farms', 'MI' FROM companies c WHERE c.name='Alrig USA' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Alexandra Abela' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, email, title, is_decision_maker, linkedin_url, city, state) SELECT 'Jayne Elson', c.id, 'PM', '(248) 646-9999', 'Jayne@alrigusa.com', NULL, false, NULL, 'Bingham Farms', 'MI' FROM companies c WHERE c.name='Alrig USA' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Jayne Elson' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, email, title, is_decision_maker, linkedin_url, city, state) SELECT 'Renee', c.id, 'PM', '(248) 646-9999', 'renee@alrigusa.com', NULL, false, NULL, 'Bingham Farms', 'MI' FROM companies c WHERE c.name='Alrig USA' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Renee' AND company_id=c.id);

-- Venator Contracting Group (1)
INSERT INTO contacts (name, company_id, role, phone, email, title, is_decision_maker, linkedin_url, city, state) SELECT 'Erin', c.id, 'PM', '(586) 229-2428', 'erins@venatorcontracting.com', NULL, false, NULL, 'Clinton Township', 'MI' FROM companies c WHERE c.name='Venator Contracting Group' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Erin' AND company_id=c.id);

-- J.G. Morris Jr. (1)
INSERT INTO contacts (name, company_id, role, phone, email, title, is_decision_maker, linkedin_url, city, state) SELECT 'Stacy', c.id, 'PM', '(734) 362-7600', 'stacy@jgmorrisjr.com', NULL, false, NULL, 'Grosse Ile', 'MI' FROM companies c WHERE c.name='J.G. Morris Jr.' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Stacy' AND company_id=c.id);

-- Life Construction & Design (1)
INSERT INTO contacts (name, company_id, role, phone, email, title, is_decision_maker, linkedin_url, city, state) SELECT 'Hannah', c.id, 'PM', '(248) 765-9037', 'admin@lifeconstruction.us', NULL, false, NULL, 'Troy', 'MI' FROM companies c WHERE c.name='Life Construction & Design' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Hannah' AND company_id=c.id);
