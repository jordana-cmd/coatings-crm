import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

const BUCKET = "opportunity-documents";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export interface OppDocument {
  id: string;
  opportunity_id: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

export function useOppDocuments(opportunityId: string | undefined) {
  const [docs, setDocs] = useState<OppDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const fetch = useCallback(async () => {
    if (!supabase || !opportunityId) return;
    const { data } = await supabase
      .from("opportunity_documents")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("uploaded_at", { ascending: false });
    setDocs((data ?? []) as OppDocument[]);
    setLoading(false);
  }, [opportunityId]);

  useEffect(() => { fetch(); }, [fetch]);

  const upload = useCallback(async (file: File): Promise<{ error: string | null }> => {
    if (!supabase || !opportunityId || !user) return { error: "Not ready" };
    if (file.size > MAX_FILE_SIZE) return { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` };

    setUploading(true);

    // Unique path: opp_id/timestamp_filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${opportunityId}/${Date.now()}_${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { contentType: file.type });

    if (uploadErr) {
      setUploading(false);
      return { error: uploadErr.message };
    }

    // Create metadata row
    const { error: insertErr } = await supabase
      .from("opportunity_documents")
      .insert({
        opportunity_id: opportunityId,
        file_name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user.id,
      });

    setUploading(false);
    if (insertErr) return { error: insertErr.message };
    await fetch();
    return { error: null };
  }, [opportunityId, user, fetch]);

  const getDownloadUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    if (!supabase) return null;
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 3600); // 1 hour
    return data?.signedUrl ?? null;
  }, []);

  const deleteDoc = useCallback(async (doc: OppDocument): Promise<{ error: string | null }> => {
    if (!supabase) return { error: "Not ready" };

    // Delete file from storage
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);

    // Delete metadata row
    const { error } = await supabase
      .from("opportunity_documents")
      .delete()
      .eq("id", doc.id);

    if (error) return { error: error.message };
    await fetch();
    return { error: null };
  }, [fetch]);

  return { docs, loading, uploading, upload, getDownloadUrl, deleteDoc, refetch: fetch };
}
