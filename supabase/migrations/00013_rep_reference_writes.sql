-- 00013_rep_reference_writes.sql
-- Field reps must self-serve adding a GC/contact during mobile quick-log;
-- blocking this breaks adoption. Reps get INSERT + UPDATE on shared
-- reference data. NOT delete — only owner/admin can remove records.

CREATE POLICY companies_rep_insert
  ON companies FOR INSERT
  WITH CHECK (current_app_role() = 'rep');

CREATE POLICY companies_rep_update
  ON companies FOR UPDATE
  USING (current_app_role() = 'rep')
  WITH CHECK (current_app_role() = 'rep');

CREATE POLICY contacts_rep_insert
  ON contacts FOR INSERT
  WITH CHECK (current_app_role() = 'rep');

CREATE POLICY contacts_rep_update
  ON contacts FOR UPDATE
  USING (current_app_role() = 'rep')
  WITH CHECK (current_app_role() = 'rep');
