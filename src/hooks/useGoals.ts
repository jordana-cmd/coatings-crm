import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";
import { ALL_SUBMITTED_STAGES } from "../lib/bidsSubmitted";

type PipelineEnum = Database["public"]["Enums"]["pipeline_type"];

type GoalRow = Database["public"]["Tables"]["goals"]["Row"];

export type GoalType = "REVENUE_WON" | "BIDS_SUBMITTED" | "BIDS_SUBMITTED_VALUE" | "WALKS_ATTENDED" | "OPPS_SOURCED" | "PROPOSALS_SENT";

export interface GoalWithProgress extends GoalRow {
  actual: number;
  pct: number;
  pace: "ahead" | "on_pace" | "behind";
  projected: number;
}

function periodRange(goal: GoalRow): { start: Date; end: Date; totalDays: number } {
  const y = goal.period_year;
  if (goal.period === "ANNUAL") {
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), totalDays: (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365 };
  }
  if (goal.period === "QUARTERLY" && goal.period_quarter) {
    const m0 = (goal.period_quarter - 1) * 3;
    const s = new Date(y, m0, 1);
    const e = new Date(y, m0 + 3, 1);
    return { start: s, end: e, totalDays: Math.round((e.getTime() - s.getTime()) / 86400000) };
  }
  if (goal.period === "MONTHLY" && goal.period_month) {
    const s = new Date(y, goal.period_month - 1, 1);
    const e = new Date(y, goal.period_month, 1);
    return { start: s, end: e, totalDays: Math.round((e.getTime() - s.getTime()) / 86400000) };
  }
  return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), totalDays: 365 };
}

function computePace(actual: number, target: number, elapsed: number, totalDays: number): { pace: "ahead" | "on_pace" | "behind"; projected: number } {
  if (elapsed <= 0 || totalDays <= 0) return { pace: "behind", projected: 0 };
  const projected = (actual / elapsed) * totalDays;
  const ratio = projected / target;
  const pace = ratio >= 1.05 ? "ahead" : ratio >= 0.95 ? "on_pace" : "behind";
  return { pace, projected };
}

export function useGoals() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;

    (async () => {
      setLoading(true);
      const { data: goalRows } = await supabase.from("goals").select("*").order("created_at");
      if (!goalRows || goalRows.length === 0) { setLoading(false); return; }

      const results: GoalWithProgress[] = [];

      for (const goal of goalRows) {
        const { start, end, totalDays } = periodRange(goal);
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        const now = new Date();
        const elapsed = Math.max(0, Math.floor((Math.min(now.getTime(), end.getTime()) - start.getTime()) / 86400000));
        const pipeFilter = goal.pipeline;

        let actual = 0;

        switch (goal.goal_type) {
          case "REVENUE_WON": {
            // SUM(amount) for WON opps. Date basis: updated_at (when status changed to WON),
            // falling back to created_at. completed_at is for job completion, not the win date.
            let q = supabase.from("opportunities").select("amount, updated_at, created_at")
              .eq("status", "WON")
              .not("amount", "is", null);
            if (pipeFilter) q = q.eq("pipeline", pipeFilter as PipelineEnum);
            const { data: wonOpps } = await q;
            actual = (wonOpps ?? [])
              .filter((o) => {
                const d = new Date(o.updated_at ?? o.created_at);
                return d >= start && d < end;
              })
              .reduce((s, o) => s + Number(o.amount ?? 0), 0);
            break;
          }

          case "BIDS_SUBMITTED": {
            // EXACT count from stage history: distinct opps that entered a "submitted" stage in the period.
            // Uses opportunity_stage_history.to_stage (exact transition record) — per-pipeline mapping in bidsSubmitted.ts.
            let q = supabase.from("opportunity_stage_history").select("opportunity_id")
              .in("to_stage", ALL_SUBMITTED_STAGES)
              .gte("changed_at", startIso)
              .lt("changed_at", endIso);
            const { data } = await q;
            // Distinct opportunity_ids; filter by pipeline if needed
            let oppIds = [...new Set((data ?? []).map((r) => r.opportunity_id))];
            if (pipeFilter && oppIds.length > 0) {
              const { data: opps } = await supabase.from("opportunities").select("id").in("id", oppIds).eq("pipeline", pipeFilter as PipelineEnum);
              oppIds = (opps ?? []).map((o) => o.id);
            }
            actual = oppIds.length;
            break;
          }

          case "WALKS_ATTENDED": {
            // Count activities of type PREBID_WALK logged in the period.
            let q = supabase.from("activities").select("id")
              .eq("type", "PREBID_WALK")
              .gte("logged_at", startIso)
              .lt("logged_at", endIso);
            // Pipeline filter requires joining through opportunities — do client-side if filtered
            if (pipeFilter) {
              const { data: oppIds } = await supabase.from("opportunities").select("id").eq("pipeline", pipeFilter as PipelineEnum);
              const ids = (oppIds ?? []).map((o) => o.id);
              if (ids.length > 0) q = q.in("opportunity_id", ids);
              else { actual = 0; break; }
            }
            const { data } = await q;
            actual = data?.length ?? 0;
            break;
          }

          case "OPPS_SOURCED": {
            // Count opps created in the period.
            let q = supabase.from("opportunities").select("id")
              .gte("created_at", startIso)
              .lt("created_at", endIso);
            if (pipeFilter) q = q.eq("pipeline", pipeFilter as PipelineEnum);
            const { data } = await q;
            actual = data?.length ?? 0;
            break;
          }

          case "PROPOSALS_SENT": {
            const proposalStages = ["SUBMITTED", "PROPOSAL"];
            let q = supabase.from("opportunity_stage_history").select("opportunity_id")
              .in("to_stage", proposalStages)
              .gte("changed_at", startIso)
              .lt("changed_at", endIso);
            const { data } = await q;
            let oppIds = [...new Set((data ?? []).map((r) => r.opportunity_id))];
            if (pipeFilter && oppIds.length > 0) {
              const { data: opps } = await supabase.from("opportunities").select("id").in("id", oppIds).eq("pipeline", pipeFilter as PipelineEnum);
              oppIds = (opps ?? []).map((o) => o.id);
            }
            actual = oppIds.length;
            break;
          }

          case "BIDS_SUBMITTED_VALUE": {
            // EXACT $ sum from stage history: SUM(amount) for opps that entered a "submitted" stage in period.
            let q = supabase.from("opportunity_stage_history").select("opportunity_id")
              .in("to_stage", ALL_SUBMITTED_STAGES)
              .gte("changed_at", startIso)
              .lt("changed_at", endIso);
            const { data: histRows } = await q;
            let bsvOppIds = [...new Set((histRows ?? []).map((r) => r.opportunity_id))];
            if (bsvOppIds.length > 0) {
              let oq = supabase.from("opportunities").select("amount").in("id", bsvOppIds).not("amount", "is", null);
              if (pipeFilter) oq = oq.eq("pipeline", pipeFilter as PipelineEnum);
              const { data: opps } = await oq;
              actual = (opps ?? []).reduce((s, o) => s + Number(o.amount ?? 0), 0);
            }
            break;
          }
        }

        const target = Number(goal.target_value);
        const pct = target > 0 ? actual / target : 0;
        const { pace, projected } = computePace(actual, target, elapsed, totalDays);

        results.push({ ...goal, actual, pct, pace, projected });
      }

      setGoals(results);
      setLoading(false);
    })();
  }, []);

  const createGoal = async (input: {
    goal_type: GoalType; pipeline?: string; period: string;
    period_year: number; period_quarter?: number; period_month?: number;
    target_value: number; owner_id?: string | null;
  }) => {
    if (!supabase) return { error: "Not ready" };
    const { error } = await supabase.from("goals").insert({
      goal_type: input.goal_type, pipeline: input.pipeline ?? null,
      period: input.period, period_year: input.period_year,
      period_quarter: input.period_quarter ?? null,
      period_month: input.period_month ?? null,
      target_value: input.target_value,
      owner_id: input.owner_id ?? null,
    });
    return { error: error?.message ?? null };
  };

  const updateGoal = async (id: string, fields: {
    goal_type?: string; pipeline?: string | null; period?: string;
    period_year?: number; period_quarter?: number | null; period_month?: number | null;
    target_value?: number;
  }) => {
    if (!supabase) return;
    await supabase.from("goals").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
  };

  const deleteGoal = async (id: string) => {
    if (!supabase) return;
    await supabase.from("goals").delete().eq("id", id);
  };

  return { goals, loading, createGoal, updateGoal, deleteGoal };
}

/** Get the CURRENT-YEAR annual revenue goal. Falls back to null if none exists for this year. */
export function useRevenueGoal(): { target: number | null; year: number; loading: boolean } {
  const currentYear = new Date().getFullYear();
  const [target, setTarget] = useState<number | null>(null);
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase
      .from("goals")
      .select("target_value, period_year")
      .eq("goal_type", "REVENUE_WON")
      .eq("period", "ANNUAL")
      .eq("period_year", currentYear)
      .is("owner_id", null)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTarget(Number(data[0].target_value));
          setYear(data[0].period_year);
        }
        // No goal for current year → target stays null
        setLoading(false);
      });
  }, [currentYear]);

  return { target, year, loading };
}
