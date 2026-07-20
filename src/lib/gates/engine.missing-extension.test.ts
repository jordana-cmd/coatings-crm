import { describe, it, expect } from "vitest";
import { canAdvance } from "./engine";
import type { OppForGates, OppRow } from "./types";

/**
 * Regression: opportunities seeded before the extension-row flow existed have
 * no bids row. The detail page used to dead-end on them ("bids extension row
 * missing"); the gate predicates dereference opp.bids and would throw.
 * A missing extension must degrade to an unmet condition, never an exception.
 */

function makeOppWithoutBids(overrides: Partial<OppRow> = {}): OppForGates {
  const opp: OppRow = {
    id: "opp-no-bids",
    name: "Legacy Opp",
    pipeline: "PUBLIC_BID",
    stage: "SOURCED",
    amount: null,
    owner_id: "user-1",
    company_id: "co-1",
    job_site_address: "123 Main St",
    job_site_lat: null,
    job_site_lng: null,
    project_tag: null,
    prevailing_wage: null,
    status: "OPEN",
    lost_reason: null,
    revisit_date: null,
    completed_at: null,
    completion_notes: null,
    final_value: null,
    expected_close_date: null,
    win_probability: null,
    stage_entered_at: null,
    next_step: null,
    next_step_date: null,
    priority: null,
    competitor: null,
    gross_profit_pct: null,
    created_at: new Date().toISOString(),
    updated_at: null,
    ...overrides,
  };
  // Mirrors what useOpportunity returns when the 1:1 embed comes back empty.
  return { ...opp, bids: null } as unknown as OppForGates;
}

describe("canAdvance: PUBLIC_BID with no bids extension row", () => {
  it("does not throw when the bids row is missing", () => {
    const opp = makeOppWithoutBids();
    expect(() => canAdvance(opp, "ESTIMATING")).not.toThrow();
  });

  it("blocks advancement and reports the missing bid details", () => {
    const opp = makeOppWithoutBids();
    const result = canAdvance(opp, "ESTIMATING");

    expect(result.allowed).toBe(false);
    expect(result.unmet).toEqual([
      { field: "bids", label: "Bid details not set up for this opportunity" },
    ]);
  });

  it("applies to later gated transitions too", () => {
    const opp = makeOppWithoutBids({ stage: "SUBMITTED" });
    const result = canAdvance(opp, "AWARDED");

    expect(result.allowed).toBe(false);
    expect(result.unmet[0].field).toBe("bids");
  });

  it("still rejects an illegal transition before reaching the bids check", () => {
    const opp = makeOppWithoutBids();
    const result = canAdvance(opp, "AWARDED");

    expect(result.allowed).toBe(false);
    expect(result.unmet[0].field).toBe("stage");
  });
});
