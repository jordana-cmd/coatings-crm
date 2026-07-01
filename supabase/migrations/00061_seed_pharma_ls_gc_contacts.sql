-- 00061_seed_pharma_ls_gc_contacts.sql
-- Seed pharma/life-sciences GC contacts: 5 new companies + 20 contacts. Idempotent.
-- Walbridge, Barton Malow, CRB, DPR Construction already exist — company inserts skip.
-- Many contacts (Jim Quasarano, Tim Dickinson, Daniel Wulf, Jason Pociask, Thomas Rossi,
-- Chris Bailey, Rob Couton) already exist from national batches — contact inserts skip.
-- No owner_id on companies/contacts (shared reference data).
-- Contact phone = company main line. GoHighLevel tags dropped (no tag system).

-- ============================================================
-- COMPANIES (5 new + 4 existing that will skip)
-- ============================================================
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'Walbridge', 'GC', 'MI', 'Detroit, MI', '(313) 963-8000', 'https://www.walbridge.com', 'Detroit', 'MI' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Walbridge');
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'Barton Malow', 'GC', 'MI', 'Southfield, MI', '(248) 436-5000', 'https://www.bartonmalow.com', 'Southfield', 'MI' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Barton Malow');
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'CRB', 'GC', 'MO', 'Kansas City, MO', '(816) 880-9800', 'https://www.crbgroup.com', 'Kansas City', 'MO' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'CRB');
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'DPR Construction', 'GC', 'CA', 'Redwood City, CA', '(650) 474-1450', 'https://www.dpr.com', 'Redwood City', 'CA' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'DPR Construction');
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'Mortenson', 'GC', 'MN', 'Minneapolis, MN', '(763) 522-2100', 'https://www.mortenson.com', 'Minneapolis', 'MN' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Mortenson');
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'Messer Construction', 'GC', 'OH', 'Cincinnati, OH', '(513) 242-1541', 'https://www.messer.com', 'Cincinnati', 'OH' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Messer Construction');
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'IPS-Integrated Project Services', 'GC', 'PA', 'Blue Bell, PA', '(610) 828-4090', 'https://www.ipsdb.com', 'Blue Bell', 'PA' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'IPS-Integrated Project Services');
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'Fluor', 'GC', 'TX', 'Irving, TX', '(469) 398-7000', 'https://www.fluor.com', 'Irving', 'TX' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Fluor');
INSERT INTO companies (name, type, region, address, phone, website, city, state) SELECT 'Jacobs', 'GC', 'TX', 'Dallas, TX', '(214) 638-0145', 'https://www.jacobs.com', 'Dallas', 'TX' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Jacobs');

-- ============================================================
-- CONTACTS (20 — ~9 will skip as dupes from prior batches)
-- ============================================================

-- Walbridge (3 — all should skip, already exist from national batch 1)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Jim Quasarano', c.id, 'ESTIMATOR', '(313) 963-8000', 'Vice President Preconstruction', true, 'https://www.linkedin.com/in/jim-quasarano-15a0252/', 'Detroit', 'MI' FROM companies c WHERE c.name='Walbridge' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Jim Quasarano' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Tim Dickinson', c.id, 'ESTIMATOR', '(313) 963-8000', 'Chief Estimator', true, 'https://www.linkedin.com/in/tim-dickinson-967674b/', 'Farmington', 'MI' FROM companies c WHERE c.name='Walbridge' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Tim Dickinson' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Daniel Wulf', c.id, 'ESTIMATOR', '(313) 963-8000', 'Director Preconstruction', true, 'https://www.linkedin.com/in/daniel-wulf-49212b64/', 'Detroit', 'MI' FROM companies c WHERE c.name='Walbridge' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Daniel Wulf' AND company_id=c.id);

-- Barton Malow (2 — both should skip, already exist from national batch 1)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Jason Pociask', c.id, 'ESTIMATOR', '(248) 436-5000', 'Director of Preconstruction', true, 'https://www.linkedin.com/in/jason-pociask-7a1a007b/', 'Detroit', 'MI' FROM companies c WHERE c.name='Barton Malow' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Jason Pociask' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Thomas Rossi', c.id, 'ESTIMATOR', '(248) 436-5000', 'Sr. Estimating Manager - Preconstruction (MEP)', false, 'https://www.linkedin.com/in/thomas-rossi-77722515/', 'Southfield', 'MI' FROM companies c WHERE c.name='Barton Malow' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Thomas Rossi' AND company_id=c.id);

-- Mortenson (2 — both new)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Travis Block', c.id, 'ESTIMATOR', '(763) 522-2100', 'Chief Estimator', true, 'https://www.linkedin.com/in/travis-block-93070717/', 'Minneapolis', 'MN' FROM companies c WHERE c.name='Mortenson' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Travis Block' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Richard Robert-Santiago', c.id, 'ESTIMATOR', '(763) 522-2100', 'Senior Cost Estimator', false, 'https://www.linkedin.com/in/richard-robert-santiago-a939734a/', 'Kenosha', 'WI' FROM companies c WHERE c.name='Mortenson' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Richard Robert-Santiago' AND company_id=c.id);

-- Messer Construction (3 — all new)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Anthony McDaniel', c.id, 'ESTIMATOR', '(513) 242-1541', 'Preconstruction Vice President', true, 'https://www.linkedin.com/in/anthony-mcdaniel-63198112/', 'Cincinnati', 'OH' FROM companies c WHERE c.name='Messer Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Anthony McDaniel' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Thomas Fromholt', c.id, 'ESTIMATOR', '(513) 242-1541', 'Director, Cost Planning & Estimating', true, 'https://www.linkedin.com/in/thomas-fromholt-7513158/', 'Cincinnati', 'OH' FROM companies c WHERE c.name='Messer Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Thomas Fromholt' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Brent Clark', c.id, 'PM', '(513) 242-1541', 'Senior Project Manager', false, 'https://www.linkedin.com/in/brent-clark-9262277/', 'Indianapolis', 'IN' FROM companies c WHERE c.name='Messer Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Brent Clark' AND company_id=c.id);

-- CRB (2 — both should skip, already exist from national batch 2)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Chris Bailey', c.id, 'ESTIMATOR', '(816) 880-9800', 'Senior Director / Chief Estimator', true, 'https://www.linkedin.com/in/chris-bailey-frics-925ab88/', 'Cranbury', 'NJ' FROM companies c WHERE c.name='CRB' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Chris Bailey' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Rob Couton', c.id, 'PM', '(816) 880-9800', 'Sr. Project Manager, Construction Group Lead (Texas)', false, 'https://www.linkedin.com/in/rob-couton-a1247415/', 'Keller', 'TX' FROM companies c WHERE c.name='CRB' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Rob Couton' AND company_id=c.id);

-- IPS-Integrated Project Services (2 — both new)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Mike Curtis', c.id, 'PM', '(610) 828-4090', 'Senior Project Director', true, 'https://www.linkedin.com/in/mikeccurtis/', 'Houston', 'TX' FROM companies c WHERE c.name='IPS-Integrated Project Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Mike Curtis' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Mark Russell', c.id, 'PM', '(610) 828-4090', 'Senior Project Manager', false, 'https://www.linkedin.com/in/mrussell50/', 'Raleigh-Durham', 'NC' FROM companies c WHERE c.name='IPS-Integrated Project Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Mark Russell' AND company_id=c.id);

-- Fluor (2 — both new)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Justin Crump', c.id, 'PM', '(469) 398-7000', 'Project Manager - Pharmaceutical Facility', false, 'https://www.linkedin.com/in/justin-crump-23632632/', 'Lebanon', 'IN' FROM companies c WHERE c.name='Fluor' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Justin Crump' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Kathleen Monk', c.id, 'PM', '(469) 398-7000', 'Site & Utilities Project Director', true, 'https://www.linkedin.com/in/kathleen-monk-4a6a666/', 'Indianapolis', 'IN' FROM companies c WHERE c.name='Fluor' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Kathleen Monk' AND company_id=c.id);

-- Jacobs (2 — both new)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Robert Nissen', c.id, 'PM', '(214) 638-0145', 'EPCM Project Director - Life Sciences', true, 'https://www.linkedin.com/in/robert-nissen/', 'Houston', 'TX' FROM companies c WHERE c.name='Jacobs' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Robert Nissen' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Heather Schenk', c.id, 'PM', '(214) 638-0145', 'Sr. Project Manager, Life Sciences', false, 'https://www.linkedin.com/in/heather-megivern-schenk/', 'Philadelphia', 'PA' FROM companies c WHERE c.name='Jacobs' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Heather Schenk' AND company_id=c.id);

-- DPR Construction (2 — Melinda Covert new; Stephen DiGiuseppi Jr new)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Melinda Covert', c.id, 'PM', '(650) 474-1450', 'Senior Project Manager', false, 'https://www.linkedin.com/in/melinda-covert/', 'Raleigh-Durham', 'NC' FROM companies c WHERE c.name='DPR Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Melinda Covert' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker, linkedin_url, city, state) SELECT 'Stephen DiGiuseppi Jr', c.id, 'ESTIMATOR', '(650) 474-1450', 'Estimator', false, 'https://www.linkedin.com/in/stephen-digiuseppi-jr-bb8b38b8/', 'East Brunswick', 'NJ' FROM companies c WHERE c.name='DPR Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Stephen DiGiuseppi Jr' AND company_id=c.id);
