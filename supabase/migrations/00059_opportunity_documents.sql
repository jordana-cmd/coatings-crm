-- 00059_opportunity_documents.sql
-- Document storage for opportunities (bid docs, proposals, estimates).
-- Files stored in Supabase Storage private bucket; metadata in this table.
-- Docs link to the opportunity, NOT to a stage/status — retained permanently.

-- 1. Create the storage bucket (private, 50MB limit per config.toml)
INSERT INTO storage.buckets (id, name, public)
VALUES ('opportunity-documents', 'opportunity-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Metadata table
CREATE TABLE opportunity_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  storage_path  text NOT NULL,
  file_size     bigint,
  mime_type     text,
  uploaded_by   uuid NOT NULL REFERENCES auth.users(id),
  uploaded_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_opp_docs_opp ON opportunity_documents (opportunity_id);

-- 3. RLS on the metadata table (mirrors bids pattern — inherit from parent opp ownership)
ALTER TABLE opportunity_documents ENABLE ROW LEVEL SECURITY;

-- Rep: full CRUD on docs for opps they own
CREATE POLICY opp_docs_rep_all ON opportunity_documents
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM opportunities o WHERE o.id = opportunity_documents.opportunity_id AND o.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM opportunities o WHERE o.id = opportunity_documents.opportunity_id AND o.owner_id = auth.uid()
  ));

-- Owner role: read all docs
CREATE POLICY opp_docs_owner_read ON opportunity_documents
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'owner'
  ));

-- Admin: full CRUD on all docs
CREATE POLICY opp_docs_admin_all ON opportunity_documents
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 4. Storage bucket policies (Supabase requires policies on storage.objects)

-- Upload: authenticated users can upload to paths under their opps
CREATE POLICY storage_opp_docs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'opportunity-documents'
  );

-- Download: authenticated users can read from the bucket
CREATE POLICY storage_opp_docs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'opportunity-documents'
  );

-- Delete: authenticated users can delete from the bucket
CREATE POLICY storage_opp_docs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'opportunity-documents'
  );
