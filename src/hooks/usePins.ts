import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { Database } from "../lib/database.types";

type OppRow = Database["public"]["Tables"]["opportunities"]["Row"];

type PinnedOpp = OppRow & { company_name: string | null };

export function usePins() {
  const { user } = useAuth();
  const [pins, setPins] = useState<PinnedOpp[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchPins = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);

    const { data } = await supabase
      .from("user_pins")
      .select("opportunity_id, opportunities(*, companies(name))")
      .eq("user_id", user.id);

    const items: PinnedOpp[] = [];
    const ids = new Set<string>();

    for (const row of data ?? []) {
      const opp = row.opportunities as unknown as OppRow & { companies: { name: string } | null };
      if (opp) {
        items.push({
          ...opp,
          company_name: opp.companies?.name ?? null,
        });
        ids.add(opp.id);
      }
    }

    setPins(items);
    setPinnedIds(ids);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPins();
  }, [fetchPins]);

  const pin = async (oppId: string) => {
    if (!supabase || !user) return;
    await supabase.from("user_pins").insert({ user_id: user.id, opportunity_id: oppId });
    await fetchPins();
  };

  const unpin = async (oppId: string) => {
    if (!supabase || !user) return;
    await supabase.from("user_pins").delete().eq("user_id", user.id).eq("opportunity_id", oppId);
    await fetchPins();
  };

  const isPinned = (oppId: string) => pinnedIds.has(oppId);

  return { pins, loading, pin, unpin, isPinned, refetch: fetchPins };
}
