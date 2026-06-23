-- 00009_create_user_profiles.sql
-- Extends auth.users with app-specific role (spec §1: rep/owner/admin).

CREATE TABLE user_profiles (
  id         uuid     PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role       app_role NOT NULL DEFAULT 'rep',
  full_name  text     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
