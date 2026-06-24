import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getPendingForOpp, type QueuedActivity } from "../lib/offline-queue";
import type { Database } from "../lib/database.types";

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];

export interface ActivityItem {
  id: string;
  type: string;
  note: string | null;
  next_action: string | null;
  next_action_at: string | null;
  logged_at: string;
  pending: boolean;
}

export function useActivities(oppId: string | undefined) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!oppId) return;
    setLoading(true);

    // Fetch synced from server
    let serverActivities: ActivityRow[] = [];
    if (supabase) {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .eq("opportunity_id", oppId)
        .order("logged_at", { ascending: false });
      serverActivities = data ?? [];
    }

    // Fetch pending from local queue
    const pendingItems: QueuedActivity[] = await getPendingForOpp(oppId);

    // Merge: pending first (they're newest), then server, dedup by id
    const seenIds = new Set<string>();
    const merged: ActivityItem[] = [];

    for (const p of pendingItems) {
      seenIds.add(p.id);
      merged.push({
        id: p.id,
        type: p.type,
        note: p.note,
        next_action: p.next_action,
        next_action_at: p.next_action_at,
        logged_at: p.logged_at,
        pending: true,
      });
    }

    for (const s of serverActivities) {
      if (!seenIds.has(s.id)) {
        merged.push({
          id: s.id,
          type: s.type,
          note: s.note,
          next_action: s.next_action,
          next_action_at: s.next_action_at,
          logged_at: s.logged_at,
          pending: false,
        });
      }
    }

    // Sort newest first
    merged.sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    setActivities(merged);
    setLoading(false);
  }, [oppId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { activities, loading, refetch: fetch };
}
