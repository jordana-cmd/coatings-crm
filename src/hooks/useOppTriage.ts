import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import type { LossReason } from "../lib/lossReasons";

/**
 * Bid / No-Bid / Close-Loss triage actions on an opportunity.
 *
 * All three go through SECURITY DEFINER RPCs (migration 00082) rather than
 * direct table updates: the owner/admin check, the reason whitelist, and the
 * stage-history write all live server-side so every caller gets them.
 *
 * Not bound to one opp id — the dashboard acts on whichever row was tapped.
 */
export function useOppTriage() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    // PromiseLike, not Promise: supabase.rpc() returns a thenable builder.
    async (oppId: string, run: () => PromiseLike<{ error: { message: string } | null }>) => {
      if (!supabase) return { error: "Not connected" };
      setPending(oppId);
      setError(null);
      const { error: err } = await run();
      setPending(null);
      if (err) {
        setError(err.message);
        return { error: err.message };
      }
      return { error: null };
    },
    []
  );

  /** Affirmative bid decision. Sets bids.go_no_go and clears a prior No Bid. */
  const affirmBid = useCallback(
    (oppId: string) => call(oppId, () => supabase!.rpc("affirm_bid", { p_opp_id: oppId })),
    [call]
  );

  /** Pass on the deal. status → NO_BID, which drops it out of every active query. */
  const setNoBid = useCallback(
    (oppId: string, noBid = true) =>
      call(oppId, () => supabase!.rpc("set_opportunity_no_bid", { p_opp_id: oppId, p_no_bid: noBid })),
    [call]
  );

  /** Close as lost from ANY stage, with a canonical reason. */
  const closeLoss = useCallback(
    (oppId: string, reason: LossReason) =>
      call(oppId, () => supabase!.rpc("close_opportunity_loss", { p_opp_id: oppId, p_reason: reason })),
    [call]
  );

  return {
    affirmBid,
    setNoBid,
    closeLoss,
    /** Opp id currently being written, or null. */
    pending,
    error,
    clearError: () => setError(null),
  };
}
