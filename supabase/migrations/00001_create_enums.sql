-- 00001_create_enums.sql
-- All custom enum types for the coatings CRM.

CREATE TYPE company_type AS ENUM (
  'GC',
  'AWARDING_AUTHORITY',
  'PLANT_OWNER',
  'ARCHITECT'
);

CREATE TYPE contact_role AS ENUM (
  'PM',
  'ESTIMATOR',
  'SUPER',
  'FM',
  'PURCHASING',
  'SPEC_WRITER'
);

CREATE TYPE pipeline_type AS ENUM (
  'PUBLIC_BID',
  'GC_CHASE',
  'FACILITY'
);

-- DISQUALIFIED added per locked decision (spec §3 red-flag rule).
-- Derived on read, never set by cron/trigger.
CREATE TYPE opp_status AS ENUM (
  'OPEN',
  'WON',
  'LOST',
  'NURTURE',
  'DISQUALIFIED'
);

CREATE TYPE activity_type AS ENUM (
  'CALL',
  'VISIT',
  'PREBID_WALK',
  'EMAIL',
  'NOTE'
);

CREATE TYPE app_role AS ENUM (
  'rep',
  'owner',
  'admin'
);
