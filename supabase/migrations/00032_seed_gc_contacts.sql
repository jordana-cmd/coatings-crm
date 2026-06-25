-- 00032_seed_gc_contacts.sql
-- Seed 7 GC companies and 58 contacts. Idempotent (NOT EXISTS guards).
-- Companies/contacts are shared reference data — no owner_id column on these tables.
-- Contact phone = company main line (individual phones unknown).

-- ============================================================
-- COMPANIES
-- ============================================================

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'EV Construction', 'GC', 'MI', 'Holland, MI', '(616) 392-2383', 'Holland', 'MI'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'EV Construction');

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'Rycon Construction', 'GC', 'PA', 'Pittsburgh, PA', '(412) 392-2525', 'Pittsburgh', 'PA'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Rycon Construction');

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'MAPP, LLC', 'GC', 'TX', 'Dallas, TX', '(214) 267-0700', 'Dallas', 'TX'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'MAPP, LLC');

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'Excel Constructors', 'GC', 'KS', 'Overland Park, KS', '(913) 261-1000', 'Overland Park', 'KS'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Excel Constructors');

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'Eleven Western Builders', 'GC', 'CA', 'Escondido, CA', '(760) 796-6346', 'Escondido', 'CA'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Eleven Western Builders');

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'Stansell Construction', 'GC', 'FL', 'Odessa, FL', '(727) 372-0781', 'Odessa', 'FL'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Stansell Construction');

INSERT INTO companies (name, type, region, address, phone, city, state)
SELECT 'Shores Builders', 'GC', 'IL', 'Centralia, IL', '(618) 532-3997', 'Centralia', 'IL'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Shores Builders');

-- ============================================================
-- CONTACTS (58 total)
-- phone = company main line; title = real job title; linkedin_url on contact
-- ============================================================

-- Helper: each INSERT uses (SELECT id FROM companies WHERE name = '...')
-- and a NOT EXISTS guard on name + company_id.

-- EV Construction (10 contacts)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Erik Butzer', c.id, 'ESTIMATOR', '(616) 392-2383', 'Preconstruction Manager', false
FROM companies c WHERE c.name = 'EV Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Erik Butzer' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Noah Burtovoy', c.id, 'ESTIMATOR', '(616) 392-2383', 'Assistant Preconstruction Manager', false
FROM companies c WHERE c.name = 'EV Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Noah Burtovoy' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Madelyn Gagnon', c.id, 'ESTIMATOR', '(616) 392-2383', 'VDC Specialist / Preconstruction', false
FROM companies c WHERE c.name = 'EV Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Madelyn Gagnon' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Jordan Gougeon', c.id, 'PM', '(616) 392-2383', 'Project Executive', true
FROM companies c WHERE c.name = 'EV Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Jordan Gougeon' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Jared Andersen', c.id, 'PM', '(616) 392-2383', 'Senior Project Manager', false
FROM companies c WHERE c.name = 'EV Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Jared Andersen' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Nick Novakoski', c.id, 'PM', '(616) 392-2383', 'Senior Project Manager', false
FROM companies c WHERE c.name = 'EV Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Nick Novakoski' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Curt Hielke', c.id, 'PM', '(616) 392-2383', 'Senior Project Manager', false
FROM companies c WHERE c.name = 'EV Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Curt Hielke' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Scott McConnelee', c.id, 'PM', '(616) 392-2383', 'Project Manager', false
FROM companies c WHERE c.name = 'EV Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Scott McConnelee' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Charlie Bennett', c.id, 'PM', '(616) 392-2383', 'Project Manager', false
FROM companies c WHERE c.name = 'EV Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Charlie Bennett' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Judd VanBergen', c.id, 'PM', '(616) 392-2383', 'Project Manager', false
FROM companies c WHERE c.name = 'EV Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Judd VanBergen' AND company_id = c.id);

-- Rycon Construction (10 contacts)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Brandon Rupert', c.id, 'ESTIMATOR', '(412) 392-2525', 'Director of Estimating and Preconstruction', true
FROM companies c WHERE c.name = 'Rycon Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Brandon Rupert' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Toni Peitz', c.id, 'ESTIMATOR', '(412) 392-2525', 'Preconstruction/Estimating Coordinator', false
FROM companies c WHERE c.name = 'Rycon Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Toni Peitz' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Bryan Baswell', c.id, 'ESTIMATOR', '(412) 392-2525', 'Sr. Estimator', false
FROM companies c WHERE c.name = 'Rycon Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Bryan Baswell' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Christopher Sosa', c.id, 'ESTIMATOR', '(412) 392-2525', 'Senior Estimator', false
FROM companies c WHERE c.name = 'Rycon Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Christopher Sosa' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Zachary Sims', c.id, 'ESTIMATOR', '(412) 392-2525', 'Estimator', false
FROM companies c WHERE c.name = 'Rycon Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Zachary Sims' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Kristopher Brice', c.id, 'PM', '(412) 392-2525', 'Project Executive', true
FROM companies c WHERE c.name = 'Rycon Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Kristopher Brice' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'R. Scott Crain', c.id, 'PM', '(412) 392-2525', 'Project Executive - Division Lead', true
FROM companies c WHERE c.name = 'Rycon Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'R. Scott Crain' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Dylan John', c.id, 'PM', '(412) 392-2525', 'Project Manager', false
FROM companies c WHERE c.name = 'Rycon Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Dylan John' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Mark Pavlich', c.id, 'PM', '(412) 392-2525', 'Project Manager', false
FROM companies c WHERE c.name = 'Rycon Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Mark Pavlich' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Halie Girgash', c.id, 'PM', '(412) 392-2525', 'Project Manager', false
FROM companies c WHERE c.name = 'Rycon Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Halie Girgash' AND company_id = c.id);

-- MAPP, LLC (10 contacts)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Trevor Davis', c.id, 'ESTIMATOR', '(214) 267-0700', 'Preconstruction Manager', false
FROM companies c WHERE c.name = 'MAPP, LLC'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Trevor Davis' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Ethan Perry', c.id, 'ESTIMATOR', '(214) 267-0700', 'Assistant Preconstruction Manager', false
FROM companies c WHERE c.name = 'MAPP, LLC'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Ethan Perry' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Charles Barham', c.id, 'ESTIMATOR', '(214) 267-0700', 'Preconstruction Engineer', false
FROM companies c WHERE c.name = 'MAPP, LLC'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Charles Barham' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Ken Gardner', c.id, 'PM', '(214) 267-0700', 'Sr. Project Manager / Sr. Preconstruction Manager', false
FROM companies c WHERE c.name = 'MAPP, LLC'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Ken Gardner' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'David Talbot', c.id, 'PM', '(214) 267-0700', 'Project Executive', true
FROM companies c WHERE c.name = 'MAPP, LLC'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'David Talbot' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Curtis Walker', c.id, 'PM', '(214) 267-0700', 'Project Executive', true
FROM companies c WHERE c.name = 'MAPP, LLC'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Curtis Walker' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Daniel Kinard', c.id, 'PM', '(214) 267-0700', 'Senior Project Manager', false
FROM companies c WHERE c.name = 'MAPP, LLC'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Daniel Kinard' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Andrew Hill', c.id, 'PM', '(214) 267-0700', 'Senior Project Manager', false
FROM companies c WHERE c.name = 'MAPP, LLC'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Andrew Hill' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Chris Hale', c.id, 'PM', '(214) 267-0700', 'Project Manager', false
FROM companies c WHERE c.name = 'MAPP, LLC'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Chris Hale' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Wade L.', c.id, 'PM', '(214) 267-0700', 'VP of Business Development', true
FROM companies c WHERE c.name = 'MAPP, LLC'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Wade L.' AND company_id = c.id);

-- Excel Constructors (6 contacts)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Troy Bechtel', c.id, 'PM', '(913) 261-1000', 'Sr. Project Manager', false
FROM companies c WHERE c.name = 'Excel Constructors'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Troy Bechtel' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Russ Befort', c.id, 'PM', '(913) 261-1000', 'Construction Project Manager', false
FROM companies c WHERE c.name = 'Excel Constructors'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Russ Befort' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Kara Dold', c.id, 'ESTIMATOR', '(913) 261-1000', 'Preconstruction and Project Administrator', false
FROM companies c WHERE c.name = 'Excel Constructors'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Kara Dold' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Terral Evans', c.id, 'PM', '(913) 261-1000', 'Project Manager', false
FROM companies c WHERE c.name = 'Excel Constructors'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Terral Evans' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Jackie Sharp', c.id, 'PURCHASING', '(913) 261-1000', 'Procurement Specialist', false
FROM companies c WHERE c.name = 'Excel Constructors'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Jackie Sharp' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Allan Obando', c.id, 'PM', '(913) 261-1000', 'Construction Project Manager', false
FROM companies c WHERE c.name = 'Excel Constructors'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Allan Obando' AND company_id = c.id);

-- Eleven Western Builders (10 contacts)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Cameron Delahoussaye', c.id, 'ESTIMATOR', '(760) 796-6346', 'Chief Estimator', true
FROM companies c WHERE c.name = 'Eleven Western Builders'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Cameron Delahoussaye' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Alex Gabrielson', c.id, 'ESTIMATOR', '(760) 796-6346', 'Senior Estimator', false
FROM companies c WHERE c.name = 'Eleven Western Builders'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Alex Gabrielson' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Shayne Martella', c.id, 'ESTIMATOR', '(760) 796-6346', 'Estimator', false
FROM companies c WHERE c.name = 'Eleven Western Builders'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Shayne Martella' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Ethan Lundgren', c.id, 'ESTIMATOR', '(760) 796-6346', 'Estimator', false
FROM companies c WHERE c.name = 'Eleven Western Builders'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Ethan Lundgren' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'John Van Hovel', c.id, 'PM', '(760) 796-6346', 'Project Executive - Auto', true
FROM companies c WHERE c.name = 'Eleven Western Builders'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'John Van Hovel' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Ruben Marquez', c.id, 'PM', '(760) 796-6346', 'Senior Project Manager', false
FROM companies c WHERE c.name = 'Eleven Western Builders'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Ruben Marquez' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Karlo Munoz', c.id, 'PM', '(760) 796-6346', 'Retail Project Manager', false
FROM companies c WHERE c.name = 'Eleven Western Builders'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Karlo Munoz' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Hugo Mejia', c.id, 'PM', '(760) 796-6346', 'Project Manager', false
FROM companies c WHERE c.name = 'Eleven Western Builders'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Hugo Mejia' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Adam Yeager', c.id, 'PM', '(760) 796-6346', 'Construction Project Manager', false
FROM companies c WHERE c.name = 'Eleven Western Builders'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Adam Yeager' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Kyle Kolloff', c.id, 'PM', '(760) 796-6346', 'Project Manager', false
FROM companies c WHERE c.name = 'Eleven Western Builders'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Kyle Kolloff' AND company_id = c.id);

-- Stansell Construction (10 contacts)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Greg Tertichny', c.id, 'ESTIMATOR', '(727) 372-0781', 'Construction Estimator', false
FROM companies c WHERE c.name = 'Stansell Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Greg Tertichny' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Parker Ronchetto', c.id, 'PM', '(727) 372-0781', 'Project Manager', false
FROM companies c WHERE c.name = 'Stansell Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Parker Ronchetto' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Daniel Normand', c.id, 'PM', '(727) 372-0781', 'Project Manager', false
FROM companies c WHERE c.name = 'Stansell Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Daniel Normand' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Cody Winn', c.id, 'PM', '(727) 372-0781', 'Project Manager', false
FROM companies c WHERE c.name = 'Stansell Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Cody Winn' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Derek Herron', c.id, 'PM', '(727) 372-0781', 'Project Manager', false
FROM companies c WHERE c.name = 'Stansell Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Derek Herron' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Micah Sieben', c.id, 'PM', '(727) 372-0781', 'Project Manager', false
FROM companies c WHERE c.name = 'Stansell Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Micah Sieben' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Bryan Crews', c.id, 'PM', '(727) 372-0781', 'Project Manager', false
FROM companies c WHERE c.name = 'Stansell Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Bryan Crews' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Shawn Abel', c.id, 'PM', '(727) 372-0781', 'Project Manager', false
FROM companies c WHERE c.name = 'Stansell Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Shawn Abel' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Rex Middleton', c.id, 'PM', '(727) 372-0781', 'Construction Project Manager', false
FROM companies c WHERE c.name = 'Stansell Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Rex Middleton' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Dillon Brophy', c.id, 'PM', '(727) 372-0781', 'Project Manager', false
FROM companies c WHERE c.name = 'Stansell Construction'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Dillon Brophy' AND company_id = c.id);

-- Shores Builders (2 contacts)
INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Drew Shores', c.id, 'PM', '(618) 532-3997', 'Project Manager', false
FROM companies c WHERE c.name = 'Shores Builders'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Drew Shores' AND company_id = c.id);

INSERT INTO contacts (name, company_id, role, phone, title, is_decision_maker)
SELECT 'Clint Johannes', c.id, 'PM', '(618) 532-3997', 'Project Manager', false
FROM companies c WHERE c.name = 'Shores Builders'
AND NOT EXISTS (SELECT 1 FROM contacts WHERE name = 'Clint Johannes' AND company_id = c.id);
