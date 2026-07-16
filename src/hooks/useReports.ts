import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";
import { ALL_SUBMITTED_STAGES } from "../lib/bidsSubmitted";

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
        const pipelines: Pipeline[] = ["PUBLIC_BID", "GC_CHASE", "FACILITY", "FEDERAL"];
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

// ── Revenue Realization (Booked vs Delivered) ──
export interface WonOppRow {
  id: string;
  amount: number;
  winDate: string; // ISO date when opp was won
  completedAt: string | null;
  completedAmount: number; // final_value or amount fallback
}

export function useRevenueData() {
  const [rows, setRows] = useState<WonOppRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;

    (async () => {
      // Fetch all WON opps
      const { data: opps } = await supabase
        .from("opportunities")
        .select("id, amount, completed_at, final_value, stage_entered_at, updated_at, created_at")
        .eq("status", "WON");

      if (!opps || opps.length === 0) { setRows([]); setLoading(false); return; }

      // Fetch win-date from stage history: AWARDED (PUBLIC_BID) or WON (GC_CHASE/FACILITY)
      const oppIds = opps.map((o) => o.id);
      const { data: histRows } = await supabase
        .from("opportunity_stage_history")
        .select("opportunity_id, to_stage, changed_at")
        .in("opportunity_id", oppIds)
        .in("to_stage", ["AWARDED", "WON"]);

      // Map opp_id → earliest win-stage timestamp
      const winDateMap: Record<string, string> = {};
      for (const h of histRows ?? []) {
        const existing = winDateMap[h.opportunity_id];
        if (!existing || h.changed_at! < existing) {
          winDateMap[h.opportunity_id] = h.changed_at!;
        }
      }

      const result: WonOppRow[] = opps.map((o) => {
        const amt = Number(o.amount ?? 0);
        return {
          id: o.id,
          amount: amt,
          winDate: winDateMap[o.id] ?? o.stage_entered_at ?? o.updated_at ?? o.created_at,
          completedAt: o.completed_at ?? null,
          completedAmount: Number(o.final_value ?? o.amount ?? 0),
        };
      });

      setRows(result);
      setLoading(false);
    })();
  }, []);

  return { rows, loading };
}

export type RevPeriod = "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "TRAILING_12" | "ALL";

export function getPeriodBounds(period: RevPeriod): { start: Date; end: Date } | null {
  if (period === "ALL") return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (period === "WEEK") {
    const day = now.getDay(); // 0=Sun
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(y, m, d + diffToMon);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
    return { start: mon, end: sun };
  }
  if (period === "MONTH") return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  if (period === "QUARTER") {
    const q = Math.floor(m / 3);
    return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 1) };
  }
  if (period === "TRAILING_12") return { start: new Date(y, m - 11, 1), end: new Date(y, m, d + 1) };
  return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
}

export function computeRevRealization(rows: WonOppRow[], period: RevPeriod) {
  const bounds = getPeriodBounds(period);

  // Period-scoped Won (by win date)
  let periodWon = 0, periodWonCount = 0;
  for (const r of rows) {
    if (bounds) {
      const wd = new Date(r.winDate);
      if (wd < bounds.start || wd >= bounds.end) continue;
    }
    periodWon += r.amount;
    periodWonCount++;
  }

  // Period-scoped Installed (by completion date)
  let periodInstalled = 0, periodInstalledCount = 0;
  for (const r of rows) {
    if (!r.completedAt) continue;
    if (bounds) {
      const cd = new Date(r.completedAt);
      if (cd < bounds.start || cd >= bounds.end) continue;
    }
    periodInstalled += r.completedAmount;
    periodInstalledCount++;
  }

  // All-time backlog (always full scope)
  let allTimeWon = 0, allTimeInstalled = 0;
  for (const r of rows) {
    allTimeWon += r.amount;
    if (r.completedAt) allTimeInstalled += r.completedAmount;
  }
  const backlog = allTimeWon - allTimeInstalled;

  return { periodWon, periodWonCount, periodInstalled, periodInstalledCount, backlog, allTimeWon, allTimeInstalled };
}

// ── Bids Submitted (adjustable timeframe) ──
export interface BidsSubmittedPeriodResult {
  total: number;
  count: number;
}

export function useBidsSubmittedByPeriod(period: RevPeriod) {
  const [data, setData] = useState<BidsSubmittedPeriodResult>({ total: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);

    (async () => {
      const bounds = getPeriodBounds(period);
      let q = supabase.from("opportunity_stage_history").select("opportunity_id")
        .in("to_stage", ALL_SUBMITTED_STAGES);
      if (bounds) {
        q = q.gte("changed_at", bounds.start.toISOString()).lt("changed_at", bounds.end.toISOString());
      }
      const { data: histRows } = await q;
      const oppIds = [...new Set((histRows ?? []).map((r) => r.opportunity_id))];

      if (oppIds.length === 0) {
        setData({ total: 0, count: 0 });
        setLoading(false);
        return;
      }

      const { data: opps } = await supabase.from("opportunities").select("amount")
        .in("id", oppIds).not("amount", "is", null);
      const total = (opps ?? []).reduce((s, o) => s + Number(o.amount ?? 0), 0);

      setData({ total, count: oppIds.length });
      setLoading(false);
    })();
  }, [period]);

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
        .in("to_stage", ALL_SUBMITTED_STAGES)
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
