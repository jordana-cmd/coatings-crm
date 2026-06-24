import type { OppWithBids, GateResult, UnmetCondition } from "./types";

/**
 * PUBLIC_BID gate predicates from spec §3.
 *
 * Stages: SOURCED → ESTIMATING → SUBMITTED → AWARDED | LOST
 *
 * Returns all unmet conditions (not just the first) so the UI can list
 * every blocker as a checklist.
 */

export function sourcedToEstimating(opp: OppWithBids): GateResult {
  const unmet: UnmetCondition[] = [];

  if (!opp.bids.plans_link) {
    unmet.push({ field: "bids.plans_link", label: "Plans link uploaded" });
  }
  if (!opp.bids.go_no_go) {
    unmet.push({ field: "bids.go_no_go", label: "Go/No-Go decision made" });
  }

  return { allowed: unmet.length === 0, unmet };
}

export function estimatingToSubmitted(opp: OppWithBids): GateResult {
  const unmet: UnmetCondition[] = [];

  if (!opp.bids.addenda_acknowledged) {
    unmet.push({ field: "bids.addenda_acknowledged", label: "Addenda acknowledged" });
  }
  if (opp.amount == null) {
    unmet.push({ field: "opportunities.amount", label: "Bid amount entered" });
  }
  if (opp.bids.prebid_walk_mandatory && !opp.bids.prebid_walk_completed) {
    unmet.push({ field: "bids.prebid_walk_completed", label: "Mandatory pre-bid walk completed" });
  }
  if (opp.bids.bond_required && !opp.bids.bond_arranged) {
    unmet.push({ field: "bids.bond_arranged", label: "Bond arranged" });
  }
  if (!opp.bids.estimate_file_url) {
    unmet.push({ field: "bids.estimate_file_url", label: "Estimate file uploaded" });
  }

  return { allowed: unmet.length === 0, unmet };
}

export function submittedToAwarded(opp: OppWithBids): GateResult {
  const unmet: UnmetCondition[] = [];

  if (!opp.bids.bid_due_at || new Date(opp.bids.bid_due_at) > new Date()) {
    unmet.push({ field: "bids.bid_due_at", label: "Bid due date has passed" });
  }

  return { allowed: unmet.length === 0, unmet };
}

// Same gate for SUBMITTED → LOST
export const submittedToLost = submittedToAwarded;

const PUBLIC_BID_GATES: Record<string, (opp: OppWithBids) => GateResult> = {
  "SOURCED→ESTIMATING": sourcedToEstimating,
  "ESTIMATING→SUBMITTED": estimatingToSubmitted,
  "SUBMITTED→AWARDED": submittedToAwarded,
  "SUBMITTED→LOST": submittedToLost,
};

export function getPublicBidGate(
  currentStage: string,
  targetStage: string
): ((opp: OppWithBids) => GateResult) | undefined {
  return PUBLIC_BID_GATES[`${currentStage}→${targetStage}`];
}
