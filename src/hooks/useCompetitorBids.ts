import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

export type CompetitorBidRow = Database["public"]["Tables"]["competitor_bids"]["Row"];

export interface NewCompetitorBid {
  bidderName: string;
  amount: number;
  isWinner: boolean;
  notes: string | null;
}

export interface CompetitorBidEdit {
  bidderName: string;
  amount: number;
  notes: string | null;
}

type Result = { error: string | null };

/** Errors carry the opportunity id — a bare Postgres message isn't traceable. */
function logFailure(oppId: string | undefined, action: string, message: string): void {
  console.error(
    JSON.stringify({ scope: "competitor_bids", action, opportunityId: oppId ?? null, error: message })
  );
}

export function useCompetitorBids(oppId: string | undefined) {
  const [bids, setBids] = useState<CompetitorBidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase || !oppId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("competitor_bids")
      .select("*")
      .eq("opportunity_id", oppId)
      .order("amount", { ascending: true });

    if (err) {
      logFailure(oppId, "list", err.message);
      setError(err.message);
      setBids([]);
    } else {
      setBids(data ?? []);
      setError(null);
    }
    setLoading(false);
  }, [oppId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const addBid = async (input: NewCompetitorBid): Promise<Result> => {
    if (!supabase || !oppId) return { error: "Not ready" };
    if (!input.bidderName.trim()) return { error: "Bidder name is required" };
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { error: "Amount must be greater than 0" };
    }

    const { data, error: err } = await supabase
      .from("competitor_bids")
      .insert({
        opportunity_id: oppId,
        bidder_name: input.bidderName.trim(),
        amount: input.amount,
        notes: input.notes?.trim() || null,
      })
      .select("id")
      .single();

    if (err) {
      logFailure(oppId, "add", err.message);
      // 23505 = unique_violation on (opportunity_id, bidder_name) — the
      // double-submit guard. Report it as already-recorded, not a failure.
      const message =
        err.code === "23505"
          ? `"${input.bidderName.trim()}" is already recorded on this deal`
          : err.message;
      return { error: message };
    }

    // Winner is set through the RPC so the one-winner swap stays atomic.
    if (input.isWinner && data) {
      const { error: winErr } = await supabase.rpc("set_competitor_bid_winner", {
        p_bid_id: data.id,
      });
      if (winErr) {
        logFailure(oppId, "add:set-winner", winErr.message);
        await fetch();
        return { error: winErr.message };
      }
    }

    await fetch();
    return { error: null };
  };

  const updateBid = async (id: string, fields: CompetitorBidEdit): Promise<Result> => {
    if (!supabase) return { error: "Not ready" };
    if (!fields.bidderName.trim()) return { error: "Bidder name is required" };
    if (!Number.isFinite(fields.amount) || fields.amount <= 0) {
      return { error: "Amount must be greater than 0" };
    }

    const { error: err } = await supabase
      .from("competitor_bids")
      .update({
        bidder_name: fields.bidderName.trim(),
        amount: fields.amount,
        notes: fields.notes?.trim() || null,
      })
      .eq("id", id);

    if (err) {
      logFailure(oppId, "update", err.message);
      return { error: err.code === "23505" ? "That bidder is already recorded on this deal" : err.message };
    }
    await fetch();
    return { error: null };
  };

  /** Promotes one row to winner, clearing any prior winner in the same transaction. */
  const markWinner = async (id: string): Promise<Result> => {
    if (!supabase) return { error: "Not ready" };
    const { error: err } = await supabase.rpc("set_competitor_bid_winner", { p_bid_id: id });
    if (err) {
      logFailure(oppId, "mark-winner", err.message);
      return { error: err.message };
    }
    await fetch();
    return { error: null };
  };

  const clearWinner = async (id: string): Promise<Result> => {
    if (!supabase) return { error: "Not ready" };
    const { error: err } = await supabase
      .from("competitor_bids")
      .update({ is_winner: false })
      .eq("id", id);
    if (err) {
      logFailure(oppId, "clear-winner", err.message);
      return { error: err.message };
    }
    await fetch();
    return { error: null };
  };

  const removeBid = async (id: string): Promise<Result> => {
    if (!supabase) return { error: "Not ready" };
    const { error: err } = await supabase.from("competitor_bids").delete().eq("id", id);
    if (err) {
      logFailure(oppId, "remove", err.message);
      return { error: err.message };
    }
    await fetch();
    return { error: null };
  };

  return { bids, loading, error, addBid, updateBid, markWinner, clearWinner, removeBid, refetch: fetch };
}
