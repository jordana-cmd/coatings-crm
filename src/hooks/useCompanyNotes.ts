import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export interface CompanyNote {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_initials: string;
  is_mine: boolean;
}

export function useCompanyNotes(companyId: string | undefined) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<CompanyNote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!supabase || !companyId) return;
    setLoading(true);

    const { data: notesData } = await supabase
      .from("company_notes")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    // Fetch author names from user_profiles
    const authorIds = [...new Set((notesData ?? []).map((n) => n.author_id))];
    const profileMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", authorIds);
      for (const p of profiles ?? []) {
        profileMap[p.id] = p.full_name;
      }
    }

    setNotes(
      (notesData ?? []).map((n) => {
        const fullName = profileMap[n.author_id] ?? "Unknown";
        const parts = fullName.split(" ");
        const initials = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : fullName.slice(0, 2).toUpperCase();
        return {
          id: n.id,
          body: n.body,
          created_at: n.created_at,
          author_name: fullName,
          author_initials: initials,
          is_mine: n.author_id === user?.id,
        };
      })
    );
    setLoading(false);
  }, [companyId, user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const addNote = async (body: string) => {
    if (!supabase || !companyId || !user) return { error: "Not ready" };
    const { error } = await supabase.from("company_notes").insert({
      company_id: companyId,
      author_id: user.id,
      body,
    });
    if (error) return { error: error.message };
    await fetch();
    return { error: null };
  };

  return { notes, loading, addNote, refetch: fetch };
}
