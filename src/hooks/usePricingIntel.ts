import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

export type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
export type SubQuoteRow = Database["public"]["Tables"]["sub_quotes"]["Row"];
export type AgentRunRow = Database["public"]["Tables"]["agent_runs"]["Row"];
export type PricePointRow = Database["public"]["Views"]["v_price_points"]["Row"];

function logFailure(scope: string, action: string, message: string, extra?: Record<string, unknown>): void {
  console.error(JSON.stringify({ scope, action, error: message, ...extra }));
}

/** Estimates (pricing-skill runs) and sub quotes for one opportunity. */
export function useJobPricing(oppId: string | undefined) {
  const [estimates, setEstimates] = useState<EstimateRow[]>([]);
  const [subQuotes, setSubQuotes] = useState<SubQuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase || !oppId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [est, sq] = await Promise.all([
      supabase
        .from("estimates")
        .select("*")
        .eq("opportunity_id", oppId)
        .order("version", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("sub_quotes")
        .select("*")
        .eq("opportunity_id", oppId)
        .order("received_at", { ascending: false, nullsFirst: false }),
    ]);
    const err = est.error?.message ?? sq.error?.message ?? null;
    if (err) logFailure("job_pricing", "list", err, { opportunityId: oppId });
    setEstimates(est.data ?? []);
    setSubQuotes(sq.data ?? []);
    setError(err);
    setLoading(false);
  }, [oppId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { estimates, subQuotes, loading, error, refetch: fetch };
}

export interface PriceToWinRow {
  opportunityId: string;
  name: string;
  pipeline: string;
  ourAmount: number;
  winnerAmount: number;
  winnerName: string;
  pctOver: number;
  lostReason: string | null;
}

export interface PricingIntel {
  priceToWin: PriceToWinRow[];
  pricePoints: PricePointRow[];
  decided90: { won: number; lost: number };
  subQuoteCount: number;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export { median };

/** Company-wide pricing intelligence: price-to-win, $/SF history, win rate. */
export function usePricingIntel() {
  const [data, setData] = useState<PricingIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const [winners, points, decided, sq] = await Promise.all([
      supabase
        .from("competitor_bids")
        .select("amount, bidder_name, opportunities!inner(id, name, pipeline, amount, lost_reason)")
        .eq("is_winner", true),
      supabase.from("v_price_points").select("*").not("price_per_sf", "is", null).limit(2000),
      supabase
        .from("opportunities")
        .select("status")
        .in("status", ["WON", "LOST"])
        .gte("updated_at", since),
      supabase.from("sub_quotes").select("id", { count: "exact", head: true }),
    ]);
    const err =
      winners.error?.message ?? points.error?.message ?? decided.error?.message ?? sq.error?.message ?? null;
    if (err) logFailure("pricing_intel", "load", err);

    const priceToWin: PriceToWinRow[] = [];
    for (const w of winners.data ?? []) {
      const o = (Array.isArray(w.opportunities) ? w.opportunities[0] : w.opportunities) as
        | { id: string; name: string; pipeline: string; amount: number | null; lost_reason: string | null }
        | null;
      if (!o || !o.amount || !w.amount) continue;
      priceToWin.push({
        opportunityId: o.id,
        name: o.name,
        pipeline: o.pipeline,
        ourAmount: Number(o.amount),
        winnerAmount: Number(w.amount),
        winnerName: w.bidder_name,
        pctOver: (Number(o.amount) - Number(w.amount)) / Number(w.amount),
        lostReason: o.lost_reason,
      });
    }
    priceToWin.sort((a, b) => b.pctOver - a.pctOver);

    const d = decided.data ?? [];
    setData({
      priceToWin,
      pricePoints: points.data ?? [],
      decided90: { won: d.filter((r) => r.status === "WON").length, lost: d.filter((r) => r.status === "LOST").length },
      subQuoteCount: sq.count ?? 0,
    });
    setError(err);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/** Recent runs of the scheduled agents (Bid Scout, intake, results chaser, ...). */
export function useAgentRuns(limit = 60) {
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("agent_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (err) logFailure("agent_runs", "list", err.message);
    setRuns(data ?? []);
    setError(err?.message ?? null);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { runs, loading, error, refetch: fetch };
}
