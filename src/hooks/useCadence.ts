import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  resolveOppNextAction,
  resolveContactNextAction,
  compareByUrgency,
} from "../lib/cadence";
import type {
  OppForCadence,
  ContactForCadence,
  TouchListItem,
} from "../lib/cadence";

/**
 * Set the manual next action for an opportunity or contact.
 * Opps use next_step/next_step_date; contacts use next_action/next_action_date.
 * Pass null action+date to clear.
 */
export function useSetNextAction() {
  const setNextAction = useCallback(
    async (
      type: "opp" | "contact",
      id: string,
      action: string | null,
      date: string | null
    ) => {
      if (!supabase) return;
      if (type === "opp") {
        await supabase
          .from("opportunities")
          .update({ next_step: action, next_step_date: date })
          .eq("id", id);
      } else {
        await supabase
          .from("contacts")
          .update({ next_action: action, next_action_date: date })
          .eq("id", id);
      }
    },
    []
  );

  return { setNextAction };
}

/** Shared fetch logic — returns ALL resolved items (no date filter). */
async function fetchAllTouchItems(): Promise<TouchListItem[]> {
  if (!supabase) return [];

  // ── Fetch OPEN opps with bids extension ──
  const { data: opps } = await supabase
    .from("opportunities")
    .select("*, bids(*), companies(name)")
    .eq("status", "OPEN");

  const oppIds = (opps ?? []).map((o) => o.id);
  const lastActivityMap: Record<string, string> = {};
  if (oppIds.length > 0) {
    const { data: activities } = await supabase
      .from("activities")
      .select("opportunity_id, logged_at")
      .in("opportunity_id", oppIds)
      .order("logged_at", { ascending: false });
    for (const a of activities ?? []) {
      if (!lastActivityMap[a.opportunity_id]) {
        lastActivityMap[a.opportunity_id] = a.logged_at;
      }
    }
  }

  const oppItems: TouchListItem[] = [];
  for (const o of opps ?? []) {
    const oppForCadence: OppForCadence = {
      ...o,
      bids: Array.isArray(o.bids) ? o.bids[0] ?? null : o.bids ?? null,
      lastContactedAt: lastActivityMap[o.id] ?? null,
    };
    const nextAction = resolveOppNextAction(oppForCadence);
    if (nextAction) {
      oppItems.push({
        type: "opp",
        id: o.id,
        name: o.name,
        companyName: (o.companies as { name: string } | null)?.name ?? null,
        pipeline: o.pipeline,
        stage: o.stage,
        lastContactedAt: lastActivityMap[o.id] ?? null,
        nextAction,
      });
    }
  }

  // ── Fetch favorited contacts (last_contacted_at is stored on the row) ──
  const { data: contacts } = await supabase
    .from("contacts")
    .select("*, companies(name)")
    .eq("is_favorite", true)
    .is("archived_at", null);

  const contactItems: TouchListItem[] = [];
  for (const c of contacts ?? []) {
    const contactForCadence: ContactForCadence = {
      ...c,
      lastContactedAt: c.last_contacted_at ?? null,
    };
    const nextAction = resolveContactNextAction(contactForCadence);
    if (nextAction) {
      contactItems.push({
        type: "contact",
        id: c.id,
        name: c.name,
        companyName: (c.companies as { name: string } | null)?.name ?? null,
        pipeline: null,
        stage: null,
        lastContactedAt: c.last_contacted_at ?? null,
        nextAction,
      });
    }
  }

  const all = [...oppItems, ...contactItems];
  all.sort((a, b) => compareByUrgency(a.nextAction, b.nextAction));
  return all;
}

/**
 * Returns touch list split into dueNow (overdue + due_today) and comingUp (next 7 days).
 */
export function useTouchList() {
  const [dueNow, setDueNow] = useState<TouchListItem[]>([]);
  const [comingUp, setComingUp] = useState<TouchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchAllTouchItems().then((all) => {
      if (cancelled) return;
      const today = new Date().toISOString().slice(0, 10);
      const soon = new Date();
      soon.setDate(soon.getDate() + 7);
      const soonStr = soon.toISOString().slice(0, 10);

      const due: TouchListItem[] = [];
      const up: TouchListItem[] = [];
      for (const item of all) {
        if (item.nextAction.dueDate <= today) {
          due.push(item);
        } else if (item.nextAction.dueDate <= soonStr) {
          up.push(item);
        }
      }
      setDueNow(due);
      setComingUp(up);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [refreshKey]);

  return { dueNow, comingUp, loading, refetch };
}
