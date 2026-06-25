import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export interface TimelineItem {
  id: string;
  kind: "activity" | "note";
  type?: string; // activity type (CALL/EMAIL etc.) — only for activities
  body: string | null;
  timestamp: string;
  opp_id?: string;
  opp_name?: string;
  direct?: boolean;
  author_name?: string;
  author_initials?: string;
}

export function useContactTimeline(contactId: string | undefined, companyId: string | undefined) {
  const { user } = useAuth();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastContacted, setLastContacted] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase || !contactId) return;
    setLoading(true);

    const merged: TimelineItem[] = [];

    // 1. Activities with contact_id = this contact (direct)
    const { data: directActs } = await supabase
      .from("activities")
      .select("id, type, note, logged_at, opportunity_id, opportunities(name)")
      .eq("contact_id", contactId)
      .order("logged_at", { ascending: false });

    for (const a of directActs ?? []) {
      merged.push({
        id: a.id,
        kind: "activity",
        type: a.type,
        body: a.note,
        timestamp: a.logged_at,
        opp_id: a.opportunity_id,
        opp_name: (a.opportunities as { name: string } | null)?.name ?? "—",
        direct: true,
      });
    }

    // 2. Activities on company opps (fallback, not already included)
    if (companyId) {
      const { data: companyOpps } = await supabase
        .from("opportunities")
        .select("id")
        .eq("company_id", companyId);
      const oppIds = (companyOpps ?? []).map((o) => o.id);
      if (oppIds.length > 0) {
        const { data: compActs } = await supabase
          .from("activities")
          .select("id, type, note, logged_at, opportunity_id, opportunities(name)")
          .in("opportunity_id", oppIds)
          .order("logged_at", { ascending: false })
          .limit(30);
        const seen = new Set(merged.map((m) => m.id));
        for (const a of compActs ?? []) {
          if (seen.has(a.id)) continue;
          merged.push({
            id: a.id,
            kind: "activity",
            type: a.type,
            body: a.note,
            timestamp: a.logged_at,
            opp_id: a.opportunity_id,
            opp_name: (a.opportunities as { name: string } | null)?.name ?? "—",
            direct: false,
          });
        }
      }
    }

    // 3. Contact notes
    const { data: notes } = await supabase
      .from("contact_notes")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });

    // Fetch author names
    const authorIds = [...new Set((notes ?? []).map((n) => n.author_id))];
    const profileMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", authorIds);
      for (const p of profiles ?? []) profileMap[p.id] = p.full_name;
    }

    for (const n of notes ?? []) {
      const fullName = profileMap[n.author_id] ?? "Unknown";
      const parts = fullName.split(" ");
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : fullName.slice(0, 2).toUpperCase();
      merged.push({
        id: `note-${n.id}`,
        kind: "note",
        body: n.body,
        timestamp: n.created_at,
        author_name: fullName,
        author_initials: initials,
      });
    }

    // Sort newest first
    merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    setItems(merged);

    // Last contacted = most recent timestamp
    setLastContacted(merged.length > 0 ? merged[0].timestamp : null);
    setLoading(false);
  }, [contactId, companyId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addNote = async (body: string) => {
    if (!supabase || !contactId || !user) return { error: "Not ready" };
    const { error } = await supabase.from("contact_notes").insert({
      contact_id: contactId,
      author_id: user.id,
      body,
    });
    if (error) return { error: error.message };
    await fetch();
    return { error: null };
  };

  return { items, loading, lastContacted, addNote, refetch: fetch };
}
