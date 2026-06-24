-- 00022_company_notes.sql
-- Company notes stream — shared, append-mostly timeline per company.

CREATE TABLE company_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_id   uuid        NOT NULL REFERENCES auth.users(id),
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_notes_timeline ON company_notes (company_id, created_at DESC);

-- RLS
ALTER TABLE company_notes ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read all notes (team visibility)
CREATE POLICY company_notes_select
  ON company_notes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Any authenticated user can insert, but only as themselves
CREATE POLICY company_notes_insert
  ON company_notes FOR INSERT
  WITH CHECK (author_id = auth.uid());

-- Author can update their own notes
CREATE POLICY company_notes_update_own
  ON company_notes FOR UPDATE
  USING (author_id = auth.uid());

-- Author can delete their own notes
CREATE POLICY company_notes_delete_own
  ON company_notes FOR DELETE
  USING (author_id = auth.uid());

-- Admin can do anything
CREATE POLICY company_notes_admin_all
  ON company_notes FOR ALL
  USING (current_app_role() = 'admin')
  WITH CHECK (current_app_role() = 'admin');

-- Grants (Supabase default schema grants cover new tables, but be explicit)
GRANT SELECT, INSERT, UPDATE, DELETE ON company_notes TO authenticated;
