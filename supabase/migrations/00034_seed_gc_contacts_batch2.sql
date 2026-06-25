-- 00034_seed_gc_contacts_batch2.sql
-- Seed batch 2: 7 GC companies + 48 contacts. Idempotent.
-- No owner_id on companies/contacts (shared reference data).
-- Contact phone = company main line (individual phones unknown).
-- NOTE: contacts table has NO linkedin_url column — linkedin data is omitted.
-- Contact city/state not stored (no such columns on contacts) — only company gets city/state.

-- ============================================================
-- COMPANIES
-- ============================================================

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'Fortney & Weygandt', 'GC', 'OH', 'North Olmsted, OH', '(440) 716-4000', 'North Olmsted', 'OH'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Fortney & Weygandt');

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'Tricon Inc.', 'GC', 'TN', 'Cleveland, TN', '(423) 479-5940', 'Cleveland', 'TN'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Tricon Inc.');

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'ARCO/Murray', 'GC', 'IL', 'Downers Grove, IL', '(331) 251-2726', 'Downers Grove', 'IL'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'ARCO/Murray');

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'Diamond Contractors', 'GC', 'MO', 'Lee''s Summit, MO', '(816) 650-9200', 'Lee''s Summit', 'MO'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Diamond Contractors');

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'Prime Retail Services', 'GC', 'GA', 'Flowery Branch, GA', '(866) 504-3511', 'Flowery Branch', 'GA'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Prime Retail Services');

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'HNB Services', 'GC', 'MD', 'Baltimore, MD', '(443) 463-2493', 'Baltimore', 'MD'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'HNB Services');

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'Marcus Construction', 'GC', 'MN', 'Willmar, MN', '(320) 222-6616', 'Willmar', 'MN'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Marcus Construction');

-- ============================================================
-- CONTACTS (48)
-- ============================================================

-- Fortney & Weygandt (10)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Matthew Pell', c.id, 'ESTIMATOR', '(440) 716-4000', 'Senior Estimator', false FROM companies c WHERE c.name='Fortney & Weygandt' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Matthew Pell' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'John Kozlowski', c.id, 'ESTIMATOR', '(440) 716-4000', 'Construction Estimator', false FROM companies c WHERE c.name='Fortney & Weygandt' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='John Kozlowski' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Jessie Krisanda', c.id, 'ESTIMATOR', '(440) 716-4000', 'Estimator', false FROM companies c WHERE c.name='Fortney & Weygandt' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Jessie Krisanda' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Danielle James', c.id, 'PM', '(440) 716-4000', 'Senior Project Manager', false FROM companies c WHERE c.name='Fortney & Weygandt' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Danielle James' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Joseph Arena', c.id, 'PM', '(440) 716-4000', 'Project Manager', false FROM companies c WHERE c.name='Fortney & Weygandt' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Joseph Arena' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Jackie Bruce', c.id, 'PM', '(440) 716-4000', 'Project Manager', false FROM companies c WHERE c.name='Fortney & Weygandt' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Jackie Bruce' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Dave Jerkins', c.id, 'PM', '(440) 716-4000', 'Project Manager', false FROM companies c WHERE c.name='Fortney & Weygandt' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Dave Jerkins' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Michael Clemons', c.id, 'PM', '(440) 716-4000', 'Project Manager', false FROM companies c WHERE c.name='Fortney & Weygandt' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Michael Clemons' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Jude Siefker', c.id, 'PM', '(440) 716-4000', 'Project Manager', false FROM companies c WHERE c.name='Fortney & Weygandt' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Jude Siefker' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Dave Conrad', c.id, 'SUPER', '(440) 716-4000', 'Project Supervisor', false FROM companies c WHERE c.name='Fortney & Weygandt' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Dave Conrad' AND company_id=c.id);

-- Tricon Inc. (1)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Jeremiah Phelps', c.id, 'PM', '(423) 479-5940', 'Project Manager', false FROM companies c WHERE c.name='Tricon Inc.' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Jeremiah Phelps' AND company_id=c.id);

-- ARCO/Murray (9)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Lawrence Slocum', c.id, 'PURCHASING', '(331) 251-2726', 'Head of Procurement', true FROM companies c WHERE c.name='ARCO/Murray' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Lawrence Slocum' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Diaa Masoud', c.id, 'PM', '(331) 251-2726', 'VP - Engineering, Procurement, Construction (EPC)', true FROM companies c WHERE c.name='ARCO/Murray' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Diaa Masoud' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Alena Denisova', c.id, 'PM', '(331) 251-2726', 'Design-Build Project Manager', false FROM companies c WHERE c.name='ARCO/Murray' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Alena Denisova' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Mark Casper', c.id, 'PM', '(331) 251-2726', 'Project Manager - Millwork', false FROM companies c WHERE c.name='ARCO/Murray' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Mark Casper' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Ali Hani', c.id, 'PM', '(331) 251-2726', 'Project Manager', false FROM companies c WHERE c.name='ARCO/Murray' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Ali Hani' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Bryan Grigsby Jr', c.id, 'PM', '(331) 251-2726', 'Project Manager', false FROM companies c WHERE c.name='ARCO/Murray' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Bryan Grigsby Jr' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Ibrahem E.', c.id, 'PURCHASING', '(331) 251-2726', 'Electrical Procurement Engineer', false FROM companies c WHERE c.name='ARCO/Murray' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Ibrahem E.' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Josh Przyborowski', c.id, 'PM', '(331) 251-2726', 'President - ARCO/Murray (Multifamily)', true FROM companies c WHERE c.name='ARCO/Murray' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Josh Przyborowski' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Katelyn Wujciga', c.id, 'PM', '(331) 251-2726', 'Project Coordinator', false FROM companies c WHERE c.name='ARCO/Murray' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Katelyn Wujciga' AND company_id=c.id);

-- Diamond Contractors (7)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Derek Noland', c.id, 'PM', '(816) 650-9200', 'Director of Construction', true FROM companies c WHERE c.name='Diamond Contractors' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Derek Noland' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Shawn Noland', c.id, 'PM', '(816) 650-9200', 'KC Regional Construction Director / Sr. Project Manager', true FROM companies c WHERE c.name='Diamond Contractors' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Shawn Noland' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Alexandra Nolker', c.id, 'PURCHASING', '(816) 650-9200', 'Sub Procurement Lead', false FROM companies c WHERE c.name='Diamond Contractors' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Alexandra Nolker' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Savannah Etter', c.id, 'PURCHASING', '(816) 650-9200', 'Subcontractor Procurement', false FROM companies c WHERE c.name='Diamond Contractors' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Savannah Etter' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Briana Church', c.id, 'PM', '(816) 650-9200', 'Project Manager', false FROM companies c WHERE c.name='Diamond Contractors' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Briana Church' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Mallory Griffith', c.id, 'PM', '(816) 650-9200', 'Project Manager', false FROM companies c WHERE c.name='Diamond Contractors' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Mallory Griffith' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Trina Arvayo', c.id, 'PM', '(816) 650-9200', 'Project Coordinator', false FROM companies c WHERE c.name='Diamond Contractors' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Trina Arvayo' AND company_id=c.id);

-- Prime Retail Services (9)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Celene Eichler', c.id, 'PM', '(866) 504-3511', 'Senior Project Manager', false FROM companies c WHERE c.name='Prime Retail Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Celene Eichler' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Jonathan McLendon', c.id, 'PM', '(866) 504-3511', 'Project Manager', false FROM companies c WHERE c.name='Prime Retail Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Jonathan McLendon' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Mike Grayson', c.id, 'PM', '(866) 504-3511', 'Project Manager', false FROM companies c WHERE c.name='Prime Retail Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Mike Grayson' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Krystia Sparks', c.id, 'PM', '(866) 504-3511', 'Assistant Project Manager', false FROM companies c WHERE c.name='Prime Retail Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Krystia Sparks' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Jelena Ilic', c.id, 'PM', '(866) 504-3511', 'Assistant Project Manager', false FROM companies c WHERE c.name='Prime Retail Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Jelena Ilic' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Kalli Shay', c.id, 'PM', '(866) 504-3511', 'Assistant Project Manager', false FROM companies c WHERE c.name='Prime Retail Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Kalli Shay' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Reid Clark', c.id, 'PM', '(866) 504-3511', 'Assistant Project Manager', false FROM companies c WHERE c.name='Prime Retail Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Reid Clark' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Lucas Grandkoski', c.id, 'PM', '(866) 504-3511', 'Construction Project Coordinator / APM', false FROM companies c WHERE c.name='Prime Retail Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Lucas Grandkoski' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Gloria Chandler', c.id, 'PM', '(866) 504-3511', 'Senior Project Coordinator', false FROM companies c WHERE c.name='Prime Retail Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Gloria Chandler' AND company_id=c.id);

-- HNB Services (3)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Tom Brennan', c.id, 'PM', '(443) 463-2493', 'President & Co-Founder', true FROM companies c WHERE c.name='HNB Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Tom Brennan' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Katie Webster', c.id, 'PM', '(443) 463-2493', 'Project Manager', false FROM companies c WHERE c.name='HNB Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Katie Webster' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Samantha Schwartz-Jones', c.id, 'PM', '(443) 463-2493', 'Project Coordinator', false FROM companies c WHERE c.name='HNB Services' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Samantha Schwartz-Jones' AND company_id=c.id);

-- Marcus Construction (9)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Eli Gunderson', c.id, 'ESTIMATOR', '(320) 222-6616', 'Construction Estimator', false FROM companies c WHERE c.name='Marcus Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Eli Gunderson' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Jesse Ellingson', c.id, 'ESTIMATOR', '(320) 222-6616', 'Construction Estimator', false FROM companies c WHERE c.name='Marcus Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Jesse Ellingson' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Steven Wetterling', c.id, 'PURCHASING', '(320) 222-6616', 'Purchasing Manager', false FROM companies c WHERE c.name='Marcus Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Steven Wetterling' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Andy Neis', c.id, 'PURCHASING', '(320) 222-6616', 'Procurement Specialist', false FROM companies c WHERE c.name='Marcus Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Andy Neis' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Micheal Lehner', c.id, 'PM', '(320) 222-6616', 'Project Manager', false FROM companies c WHERE c.name='Marcus Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Micheal Lehner' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Travis Roediger', c.id, 'PM', '(320) 222-6616', 'Project Manager', false FROM companies c WHERE c.name='Marcus Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Travis Roediger' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Joe DeGrote', c.id, 'PM', '(320) 222-6616', 'Project Manager', false FROM companies c WHERE c.name='Marcus Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Joe DeGrote' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Justin Chvala', c.id, 'PM', '(320) 222-6616', 'Project Manager', false FROM companies c WHERE c.name='Marcus Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Justin Chvala' AND company_id=c.id);
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker) SELECT 'Blake Karsch', c.id, 'PM', '(320) 222-6616', 'Assistant Project Manager', false FROM companies c WHERE c.name='Marcus Construction' AND NOT EXISTS (SELECT 1 FROM contacts WHERE name='Blake Karsch' AND company_id=c.id);
