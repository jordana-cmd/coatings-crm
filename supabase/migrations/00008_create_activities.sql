-- 00008_create_activities.sql
-- Spec §2: activities table (the quick-log target).

CREATE TABLE activities (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid          NOT NULL REFERENCES opportunities (id) ON DELETE CASCADE,
  user_id         uuid          NOT NULL REFERENCES auth.users (id),
  type            activity_type NOT NULL,
  note            text,
  voice_note_url  text,
  next_action     text,
  next_action_at  date,
  logged_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_opportunity_id ON activities (opportunity_id);
CREATE INDEX idx_activities_user_id        ON activities (user_id);
CREATE INDEX idx_activities_next_action_at ON activities (next_action_at) WHERE next_action_at IS NOT NULL;
CREATE INDEX idx_activities_logged_at      ON activities (logged_at);
