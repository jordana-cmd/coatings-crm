-- 00070_add_government_agency_type.sql
-- Adds GOVERNMENT_AGENCY to company_type enum for federal contracting entities.

ALTER TYPE company_type ADD VALUE 'GOVERNMENT_AGENCY';
