-- 00052_company_bid_list_flag.sql
-- Manual "on their bid list" flag for companies.
-- Plan room symbol uses existing planroom_url (no schema change needed).
-- View refresh is in 00053.

ALTER TABLE companies
  ADD COLUMN on_bid_list boolean NOT NULL DEFAULT false;
