import type { OppWithBids } from "./types";

/**
 * Spec §3 red-flag rule: if prebid_walk_mandatory AND prebid_walk_at has
 * passed AND prebid_walk_completed is false → opp is DISQUALIFIED.
 * A missed mandatory walk = legally cannot bid.
 *
 * This is derived on read (CLAUDE.md locked decision), never persisted by cron.
 */
export function isDisqualified(opp: OppWithBids): boolean {
  return (
    opp.bids.prebid_walk_mandatory &&
    !!opp.bids.prebid_walk_at &&
    new Date(opp.bids.prebid_walk_at) < new Date() &&
    !opp.bids.prebid_walk_completed
  );
}
