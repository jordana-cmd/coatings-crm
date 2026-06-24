import type { Database } from "../database.types";

export type OppRow = Database["public"]["Tables"]["opportunities"]["Row"];
export type BidsRow = Database["public"]["Tables"]["bids"]["Row"];
export type FacilityRow = Database["public"]["Tables"]["facility_details"]["Row"];

/** An opportunity joined with its extension row for gate evaluation. */
export type OppWithBids = OppRow & { bids: BidsRow };
export type OppWithFacility = OppRow & { facility_details: FacilityRow };
export type OppForGates = OppWithBids | OppWithFacility;

export interface UnmetCondition {
  field: string;
  label: string;
}

export interface GateResult {
  allowed: boolean;
  unmet: UnmetCondition[];
}
