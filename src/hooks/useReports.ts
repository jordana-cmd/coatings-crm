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
