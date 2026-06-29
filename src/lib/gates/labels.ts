/**
 * Human-readable action labels for gate conditions.
 * Maps from the gate engine's field key to a user-facing action sentence.
 * Used by both the kanban toast and the opp-detail checklist.
 * Covers all 3 pipelines' conditions.
 */

export const GATE_ACTION_LABELS: Record<string, string> = {
  // PUBLIC_BID: SOURCED → ESTIMATING
  "bids.plans_link": "Add a plans/specs link",

  // PUBLIC_BID: ESTIMATING → SUBMITTED
  "bids.addenda_acknowledged": "Confirm addenda acknowledged",
  "opportunities.amount": "Enter the bid amount",
  "bids.prebid_walk_completed": "Log the mandatory pre-bid walk",
  "bids.bond_arranged": "Record the bond arrangement",
  "bids.estimate_file_url": "Attach the estimate file",

  // PUBLIC_BID: SUBMITTED → AWARDED/LOST
  "bids.bid_due_at": "Bid due date must pass before advancing",
  "opportunities.gross_profit_pct": "Record the gross profit % before closing won",

  // GC_CHASE (stubs — gate engine throws for these pipelines, but labels ready)
  "bids.invited": "Confirm invitation from GC",
  "bids.quote_delivered": "Deliver the quote to GC",
  "bids.gc_carried_us": "Confirm GC carried our number",
  "bids.sub_po_received": "Receive sub PO from GC",
  "opportunities.lost_reason": "Record the loss reason",

  // FACILITY (stubs)
  "facility_details.contact_made": "Make initial contact",
  "facility_details.budget_cycle": "Identify the budget cycle",
  "facility_details.survey_completed": "Complete the site survey",
  "facility_details.decision_maker_id": "Identify the decision maker",
  "facility_details.proposal_delivered": "Deliver the proposal",
  "facility_details.po_or_capital_approval": "Obtain PO or capital approval",
  "opportunities.revisit_date": "Set a revisit date",

  // Stage transition
  "stage": "Invalid stage transition",
};

/** Convert an unmet condition to a friendly action label */
export function friendlyLabel(field: string, fallbackLabel: string): string {
  return GATE_ACTION_LABELS[field] ?? fallbackLabel;
}

/** Parse the server RPC error message ("Gate blocked: X; Y; Z") into friendly labels */
export function parseRpcBlockReason(errorMessage: string): string[] {
  const match = errorMessage.match(/Gate blocked:\s*(.+)/);
  if (!match) return [errorMessage];
  return match[1].split(";").map((s) => s.trim()).filter(Boolean);
}
