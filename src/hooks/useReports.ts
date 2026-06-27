import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Pipeline = Database["public"]["Enums"]["pipeline_type"];

// Report 1: Weighted forecast 90d
export interface ForecastRow {
  pipeline: Pipeline;
  close_month: string;
  committed_weighted: number;
  upside_weighted: number;
  total_weighted: number;
  committed_count: number;
  upside_count: number;
}

export function useForecast90d() {
  const [data, setData] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("v_weighted_forecast_90d").select("*").then(({ data: rows }) => {
      setData((rows ?? []).map((r) => ({
        pipeline: r.pipeline! as Pipeline,
        close_month: r.close_month!,
        committed_weighted: Number(r.committed_weighted ?? 0),
        upside_weighted: Number(r.upside_weighted ?? 0),
        total_weighted: Number(r.total_weighted ?? 0),
        committed_count: Number(r.committed_count ?? 0),
        upside_count: Number(r.upside_count ?? 0),
      })));
      setLoading(false);
    });
  }, []);

  return { data, loading };
}

// Report 2: Closed-won YTD vs goal
export interface ClosedWonRow {
  pipeline: Pipeline;
  closed_won_ytd: number;
  won_count: number;
}

export function useClosedWonVsGoal() {
  const [data, setData] = useState<ClosedWonRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("v_closed_won_vs_goal").select("*").then(({ data: rows }) => {
      setData((rows ?? []).map((r) => ({
        pipeline: r.pipeline! as Pipeline,
        closed_won_ytd: Number(r.closed_won_ytd ?? 0),
        won_count: Number(r.won_count ?? 0),
      })));
      setLoading(false);
    });
  }, []);

  return { data, loading };
}

// Report 4: Customer concentration
export interface ConcentrationRow {
  company_id: string;
  company_name: string;
  pipeline: Pipeline;
  won_dollars: number;
  won_count: number;
}

export function useCustomerConcentration() {
  const [data, setData] = useState<ConcentrationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("v_customer_concentration").select("*").then(({ data: rows }) => {
      setData((rows ?? []).map((r) => ({
        company_id: r.company_id!,
        company_name: r.company_name!,
        pipeline: r.pipeline! as Pipeline,
        won_dollars: Number(r.won_dollars ?? 0),
        won_count: Number(r.won_count ?? 0),
      })));
      setLoading(false);
    });
  }, []);

  return { data, loading };
}

// Report 5: Closing this month
export interface ClosingRow {
  id: string;
  name: string;
  company_name: string;
  amount: number | null;
  weighted_amount: number | null;
  win_probability: number | null;
  stage: string;
  pipeline: Pipeline;
  next_step: string | null;
  next_step_date: string | null;
  expected_close_date: string | null;
}

export function useClosingThisMonth() {
  const [data, setData] = useState<ClosingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("v_closing_this_month").select("*").then(({ data: rows }) => {
      setData((rows ?? []).map((r) => ({
        id: r.id!,
        name: r.name!,
        company_name: r.company_name!,
        amount: r.amount != null ? Number(r.amount) : null,
        weighted_amount: r.weighted_amount != null ? Number(r.weighted_amount) : null,
        win_probability: r.win_probability != null ? Number(r.win_probability) : null,
        stage: r.stage!,
        pipeline: r.pipeline! as Pipeline,
        next_step: r.next_step ?? null,
        next_step_date: r.next_step_date ?? null,
        expected_close_date: r.expected_close_date ?? null,
      })));
      setLoading(false);
    });
  }, []);

  return { data, loading };
}

// Report 6: Stale leaks
export interface StaleRow {
  id: string;
  name: string;
  company_name: string;
  amount: number | null;
  stage: string;
  pipeline: Pipeline;
  next_step_date: string | null;
  last_activity_at: string | null;
}

export function useStaleLeaks() {
  const [data, setData] = useState<StaleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("v_stale_leaks").select("*").then(({ data: rows }) => {
      setData((rows ?? []).map((r) => ({
        id: r.id!,
        name: r.name!,
        company_name: r.company_name!,
        amount: r.amount != null ? Number(r.amount) : null,
        stage: r.stage!,
        pipeline: r.pipeline! as Pipeline,
        next_step_date: r.next_step_date ?? null,
        last_activity_at: r.last_activity_at ?? null,
      })));
      setLoading(false);
    });
  }, []);

  return { data, loading };
}

// Report 7: Bids out awaiting
export interface BidOutRow {
  opp_id: string;
  project_name: string;
  company_name: string;
  pipeline: Pipeline;
  our_number: number | null;
  decision_date: string | null;
  days_until: number | null;
  gc_name: string | null;
}

export function useBidOutAwaiting() {
  const [data, setData] = useState<BidOutRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("v_bid_out_awaiting").select("*").then(({ data: rows }) => {
      setData((rows ?? []).map((r) => ({
        opp_id: r.opp_id!,
        project_name: r.project_name!,
        company_name: r.company_name!,
        pipeline: r.pipeline! as Pipeline,
        our_number: r.our_number != null ? Number(r.our_number) : null,
        decision_date: r.decision_date ?? null,
        days_until: r.days_until != null ? Number(r.days_until) : null,
        gc_name: r.gc_name ?? null,
      })));
      setLoading(false);
    });
  }, []);

  return { data, loading };
}

// ── Win Rate per Pipeline ──
export interface WinRateRow {
  pipeline: Pipeline;
  won: number;
  lost: number;
  decided: number;
  rate: number | null; // null when decided === 0
}

export function useWinRate() {
  const [data, setData] = useState<WinRateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("opportunities")
      .select("pipeline, status")
      .in("status", ["WON", "LOST"])
      .then(({ data: rows }) => {
        const map: Record<string, { won: number; lost: number }> = {};
        for (const r of rows ?? []) {
          const p = r.pipeline as string;
          if (!map[p]) map[p] = { won: 0, lost: 0 };
          if (r.status === "WON") map[p].won++;
          else map[p].lost++;
        }
        const pipelines: Pipeline[] = ["PUBLIC_BID", "GC_CHASE", "FACILITY"];
        setData(
          pipelines.map((p) => {
            const { won = 0, lost = 0 } = map[p] ?? {};
            const decided = won + lost;
            return { pipeline: p, won, lost, decided, rate: decided > 0 ? won / decided : null };
          })
        );
        setLoading(false);
      });
  }, []);

  return { data, loading };
}

// ── Dollars Won vs Dollars Installed ──
export interface DollarsWonInstalled {
  dollarsWon: number;
  dollarsInstalled: number;
  backlog: number;
  wonCount: number;
  installedCount: number;
}

export function useDollarsWonInstalled() {
  const [data, setData] = useState<DollarsWonInstalled>({ dollarsWon: 0, dollarsInstalled: 0, backlog: 0, wonCount: 0, installedCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("opportunities")
      .select("amount, completed_at, final_value, status")
      .eq("status", "WON")
      .then(({ data: rows }) => {
        let dollarsWon = 0;
        let dollarsInstalled = 0;
        let wonCount = 0;
        let installedCount = 0;
        for (const r of rows ?? []) {
          const amt = Number(r.amount ?? 0);
          dollarsWon += amt;
          wonCount++;
          if (r.completed_at != null) {
            dollarsInstalled += Number(r.final_value ?? amt);
            installedCount++;
          }
        }
        setData({ dollarsWon, dollarsInstalled, backlog: dollarsWon - dollarsInstalled, wonCount, installedCount });
        setLoading(false);
      });
  }, []);

  return { data, loading };
}

// ── Bids This Week ──
export interface BidsThisWeek {
  submitted: number;
  target: number | null; // null = no goal set
}

function getWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
  return { start: mon.toISOString(), end: sun.toISOString() };
}

export function useBidsThisWeek() {
  const [data, setData] = useState<BidsThisWeek>({ submitted: 0, target: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    const { start, end } = getWeekBounds();

    (async () => {
      // Count bids submitted this week from stage history
      const { data: histRows } = await supabase
        .from("opportunity_stage_history")
        .select("opportunity_id")
        .eq("to_stage", "SUBMITTED")
        .gte("changed_at", start)
        .lt("changed_at", end);

      const submitted = new Set((histRows ?? []).map((r) => r.opportunity_id)).size;

      // Look for a BIDS_SUBMITTED goal to derive weekly pace
      const { data: goalRows } = await supabase
        .from("goals")
        .select("target_value, period, period_year, period_quarter, period_month")
        .eq("goal_type", "BIDS_SUBMITTED")
        .is("owner_id", null)
        .limit(1);

      let target: number | null = null;
      if (goalRows && goalRows.length > 0) {
        const g = goalRows[0];
        const tv = Number(g.target_value);
        if (g.period === "ANNUAL") target = tv / 52;
        else if (g.period === "QUARTERLY") target = tv / 13;
        else if (g.period === "MONTHLY") target = tv / 4.33;
      }

      setData({ submitted, target });
      setLoading(false);
    })();
  }, []);

  return { data, loading };
}

// Report 8: Coverage gap (computed from other reports in UI)
export function computeCoverageGap(
  weightedPipeline: number,
  closedWonYtd: number,
  annualGoal: number
): { remaining: number; coverage: number; verdict: "green" | "yellow" | "red" } {
  const remaining = annualGoal - closedWonYtd;
  const coverage = remaining > 0 ? weightedPipeline / remaining : 999;
  const verdict = coverage >= 3 ? "green" : coverage >= 1.5 ? "yellow" : "red";
  return { remaining, coverage, verdict };
}
