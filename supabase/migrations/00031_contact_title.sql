-- 00030_contact_title.sql
-- Add a free-text title column to contacts (the person's real job title,
-- distinct from the role enum which is a functional category).

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS title text;
