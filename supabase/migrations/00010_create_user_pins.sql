-- 00010_create_user_pins.sql
-- Join table for "Hot list" (spec §4: manually pinned opps).
-- Locked decision: user_pins(user_id, opportunity_id) for multi-user support.

CREATE TABLE user_pins (
  user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities (id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, opportunity_id)
);
