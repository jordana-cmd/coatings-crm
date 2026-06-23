-- 00002_create_companies.sql
-- Spec §2: companies table.

CREATE TABLE companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text         NOT NULL,
  type        company_type NOT NULL,
  region      text         NOT NULL,
  address     text         NOT NULL,
  website     text,
  notes       text,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_type ON companies (type);
CREATE INDEX idx_companies_region ON companies (region);
