import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type OppRow = Database["public"]["Tables"]["opportunities"]["Row"];
type BidsRow = Database["public"]["Tables"]["bids"]["Row"];

export interface BidDeadline {
  opp: OppRow & { company_name: string | null };
  bids: BidsRow;
}

export interface WalkToday {
  opp: OppRow & { company_name: string | null };
  bids: BidsRow;
}

export interface FollowUp {
  id: string;
  opportunity_id: string;
  opp_name: string;
  company_name: string | null;
  next_action: string;
  next_action_at: string;
  overdue: boolean;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

export function useDailyView() {
  const [deadlines, setDeadlines] = useState<BidDeadline[]>([]);
  const [walks, setWalks] = useState<WalkToday[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { start, end } = todayRange();
    const todayDate = new Date().toISOString().slice(0, 10);

    // Bid deadlines today
    const { data: bidData } = await supabase
      .from("bids")
      .select("*, opportunities(*, companies(name))")
      .gte("bid_due_at", start)
      .lt("bid_due_at", end)
      .order("bid_due_at", { ascending: true });

    const dl: BidDeadline[] = [];
    for (const row of bidData ?? []) {
      const opp = row.opportunities as unknown as OppRow & { companies: { name: string } | null };
      if (opp) {
        dl.push({
          opp: { ...opp, company_name: opp.companies?.name ?? null },
          bids: row,
        });
      }
    }
    setDeadlines(dl);

    // Pre-bid walks today
    const { data: walkData } = await supabase
      .from("bids")
      .select("*, opportunities(*, companies(name))")
      .gte("prebid_walk_at", start)
      .lt("prebid_walk_at", end)
      .order("prebid_walk_at", { ascending: true });

    const wk: WalkToday[] = [];
    for (const row of walkData ?? []) {
      const opp = row.opportunities as unknown as OppRow & { companies: { name: string } | null };
      if (opp) {
        wk.push({
          opp: { ...opp, company_name: opp.companies?.name ?? null },
          bids: row,
        });
      }
    }
    setWalks(wk);

    // Follow-ups due (next_action_at <= today)
    const { data: fuData } = await supabase
      .from("activities")
      .select("id, opportunity_id, next_action, next_action_at, opportunities(name, companies(name))")
      .not("next_action", "is", null)
      .not("next_action_at", "is", null)
      .lte("next_action_at", todayDate)
      .order("next_action_at", { ascending: true });

    const fu: FollowUp[] = [];
    for (const row of fuData ?? []) {
      const opp = row.opportunities as unknown as { name: string; companies: { name: string } | null } | null;
      if (opp && row.next_action && row.next_action_at) {
        fu.push({
          id: row.id,
          opportunity_id: row.opportunity_id,
          opp_name: opp.name,
          company_name: opp.companies?.name ?? null,
          next_action: row.next_action,
          next_action_at: row.next_action_at,
          overdue: row.next_action_at < todayDate,
        });
      }
    }
    setFollowUps(fu);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { deadlines, walks, followUps, loading, refetch: fetch };
}
