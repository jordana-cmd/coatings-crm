-- 00026_contact_notes.sql
-- Contact notes stream — mirrors company_notes (00022) exactly.

CREATE TABLE contact_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  author_id   uuid        NOT NULL REFERENCES auth.users(id),
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_notes_timeline ON contact_notes (contact_id, created_at DESC);

ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY contact_notes_select
  ON contact_notes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY contact_notes_insert
  ON contact_notes FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY contact_notes_update_own
  ON contact_notes FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY contact_notes_delete_own
  ON contact_notes FOR DELETE
  USING (author_id = auth.uid());

CREATE POLICY contact_notes_admin_all
  ON contact_notes FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON contact_notes TO authenticated;
