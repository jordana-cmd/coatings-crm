-- 00003_create_contacts.sql
-- Spec §2: contacts table.

CREATE TABLE contacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid         NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  name              text         NOT NULL,
  role              contact_role NOT NULL,
  phone             text         NOT NULL,
  email             text,
  is_decision_maker boolean      NOT NULL DEFAULT false,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_company_id ON contacts (company_id);
