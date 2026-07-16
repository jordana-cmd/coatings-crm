import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type OppRow = Database["public"]["Tables"]["opportunities"]["Row"];
type BidsRow = Database["public"]["Tables"]["bids"]["Row"];
type Pipeline = Database["public"]["Enums"]["pipeline_type"];

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  kind: "bid_due" | "walk" | "response_deadline" | "site_visit";
  oppId: string;
  oppName: string;
  companyName: string | null;
  pipeline: Pipeline;
  mandatory?: boolean;
  bids?: BidsRow;
  opp: OppRow;
}

export function useCalendarEvents(year: number, month: number, pipelineFilter: Pipeline | "ALL") {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);

    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 1).toISOString();

    // Bid due dates in month
    let bidQuery = supabase
      .from("bids")
      .select("*, opportunities(*, companies(name))")
      .gte("bid_due_at", start)
      .lt("bid_due_at", end)
      .order("bid_due_at", { ascending: true });

    const { data: bidData } = await bidQuery;

    // Walk dates in month
    let walkQuery = supabase
      .from("bids")
      .select("*, opportunities(*, companies(name))")
      .gte("prebid_walk_at", start)
      .lt("prebid_walk_at", end)
      .order("prebid_walk_at", { ascending: true });

    const { data: walkData } = await walkQuery;

    // FEDERAL response deadlines in month
    const { data: fedDeadlineData } = await supabase
      .from("federal_details")
      .select("*, opportunities(*, companies(name))")
      .gte("response_deadline", start)
      .lt("response_deadline", end)
      .order("response_deadline", { ascending: true });

    // FEDERAL site visits in month
    const { data: fedVisitData } = await supabase
      .from("federal_details")
      .select("*, opportunities(*, companies(name))")
      .gte("site_visit_date", start)
      .lt("site_visit_date", end)
      .order("site_visit_date", { ascending: true });

    const items: CalendarEvent[] = [];

    for (const row of bidData ?? []) {
      const opp = row.opportunities as unknown as OppRow & { companies: { name: string } | null };
      if (!opp) continue;
      if (pipelineFilter !== "ALL" && opp.pipeline !== pipelineFilter) continue;
      const dt = new Date(row.bid_due_at!);
      items.push({
        id: `bid-${row.id}`,
        date: dt.toISOString().slice(0, 10),
        time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        kind: "bid_due",
        oppId: opp.id,
        oppName: opp.name,
        companyName: opp.companies?.name ?? null,
        pipeline: opp.pipeline as Pipeline,
        bids: row,
        opp,
      });
    }

    for (const row of walkData ?? []) {
      const opp = row.opportunities as unknown as OppRow & { companies: { name: string } | null };
      if (!opp) continue;
      if (pipelineFilter !== "ALL" && opp.pipeline !== pipelineFilter) continue;
      const dt = new Date(row.prebid_walk_at!);
      items.push({
        id: `walk-${row.id}`,
        date: dt.toISOString().slice(0, 10),
        time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        kind: "walk",
        oppId: opp.id,
        oppName: opp.name,
        companyName: opp.companies?.name ?? null,
        pipeline: opp.pipeline as Pipeline,
        mandatory: row.prebid_walk_mandatory,
        bids: row,
        opp,
      });
    }

    for (const row of fedDeadlineData ?? []) {
      const opp = row.opportunities as unknown as OppRow & { companies: { name: string } | null };
      if (!opp) continue;
      if (pipelineFilter !== "ALL" && opp.pipeline !== pipelineFilter) continue;
      const dt = new Date(row.response_deadline!);
      items.push({
        id: `fed-deadline-${row.id}`,
        date: dt.toISOString().slice(0, 10),
        time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        kind: "response_deadline",
        oppId: opp.id,
        oppName: opp.name,
        companyName: opp.companies?.name ?? null,
        pipeline: opp.pipeline as Pipeline,
        opp,
      });
    }

    for (const row of fedVisitData ?? []) {
      const opp = row.opportunities as unknown as OppRow & { companies: { name: string } | null };
      if (!opp) continue;
      if (pipelineFilter !== "ALL" && opp.pipeline !== pipelineFilter) continue;
      const dt = new Date(row.site_visit_date!);
      items.push({
        id: `fed-visit-${row.id}`,
        date: dt.toISOString().slice(0, 10),
        time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        kind: "site_visit",
        oppId: opp.id,
        oppName: opp.name,
        companyName: opp.companies?.name ?? null,
        pipeline: opp.pipeline as Pipeline,
        mandatory: row.site_visit_mandatory,
        opp,
      });
    }

    setEvents(items);
    setLoading(false);
  }, [year, month, pipelineFilter]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { events, loading };
}
