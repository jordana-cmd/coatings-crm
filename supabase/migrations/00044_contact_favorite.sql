-- 00044_contact_favorite.sql
-- Add is_favorite flag to contacts for starring pursued contacts.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_contacts_favorite ON contacts (id) WHERE is_favorite = true;
