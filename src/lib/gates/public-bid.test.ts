import { describe, it, expect } from "vitest";
import { canAdvance } from "./engine";
import { isDisqualified } from "./disqualification";
import type { OppWithBids, BidsRow, OppRow } from "./types";

// ── helpers ────────────────────────────────────────────────────────

function makeOpp(overrides: Partial<OppRow> = {}): OppRow {
  return {
    id: "opp-1",
    name: "Test Opp",
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
    created_at: new Date().toISOString(),
    updated_at: null,
    ...overrides,
  };
}

function makeBids(overrides: Partial<BidsRow> = {}): BidsRow {
  return {
    id: "bid-1",
    opportunity_id: "opp-1",
    bid_due_at: null,
    prebid_walk_at: null,
    prebid_walk_mandatory: false,
    prebid_walk_completed: false,
    plans_link: null,
    addenda_acknowledged: false,
    bond_required: false,
    bond_amount: null,
    bond_arranged: false,
    estimate_file_url: null,
    gc_company_id: null,
    gc_carried_us: null,
    bid_tab_position: null,
    low_bid_amount: null,
    go_no_go: false,
    invited: false,
    quote_delivered: false,
    sub_po_received: false,
    gc_bid_date: null,
    expected_award_date: null,
    ...overrides,
  };
}

function makeOppWithBids(
  oppOverrides: Partial<OppRow> = {},
  bidsOverrides: Partial<BidsRow> = {}
): OppWithBids {
  const opp = makeOpp(oppOverrides);
  return { ...opp, bids: makeBids({ opportunity_id: opp.id, ...bidsOverrides }) };
}

// ── SOURCED → ESTIMATING ───────────────────────────────────────────

describe("PUBLIC_BID: SOURCED → ESTIMATING", () => {
  it("allows when plans_link present (go_no_go irrelevant)", () => {
    const opp = makeOppWithBids(
      { stage: "SOURCED" },
      { plans_link: "https://planroom.com/123", go_no_go: false }
    );
    const result = canAdvance(opp, "ESTIMATING");
    expect(result.allowed).toBe(true);
    expect(result.unmet).toHaveLength(0);
  });

  it("blocks when plans_link missing", () => {
    const opp = makeOppWithBids(
      { stage: "SOURCED" },
      { plans_link: null }
    );
    const result = canAdvance(opp, "ESTIMATING");
    expect(result.allowed).toBe(false);
    expect(result.unmet).toHaveLength(1);
    expect(result.unmet).toContainEqual(
      expect.objectContaining({ field: "bids.plans_link" })
    );
  });
});

// ── ESTIMATING → SUBMITTED ─────────────────────────────────────────

describe("PUBLIC_BID: ESTIMATING → SUBMITTED", () => {
  const allGatesPass = {
    oppOverrides: { stage: "ESTIMATING" as const, amount: 50000 },
    bidsOverrides: {
      addenda_acknowledged: true,
      estimate_file_url: "https://storage/est.pdf",
      prebid_walk_mandatory: false,
      bond_required: false,
    },
  };

  it("allows when all gates pass (no walk, no bond)", () => {
    const opp = makeOppWithBids(
      allGatesPass.oppOverrides,
      allGatesPass.bidsOverrides
    );
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(true);
  });

  it("blocks when addenda not acknowledged", () => {
    const opp = makeOppWithBids(allGatesPass.oppOverrides, {
      ...allGatesPass.bidsOverrides,
      addenda_acknowledged: false,
    });
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(false);
    expect(result.unmet).toContainEqual(
      expect.objectContaining({ field: "bids.addenda_acknowledged" })
    );
  });

  it("blocks when amount is null", () => {
    const opp = makeOppWithBids(
      { ...allGatesPass.oppOverrides, amount: null },
      allGatesPass.bidsOverrides
    );
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(false);
    expect(result.unmet).toContainEqual(
      expect.objectContaining({ field: "opportunities.amount" })
    );
  });

  it("blocks when estimate file missing", () => {
    const opp = makeOppWithBids(allGatesPass.oppOverrides, {
      ...allGatesPass.bidsOverrides,
      estimate_file_url: null,
    });
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(false);
    expect(result.unmet).toContainEqual(
      expect.objectContaining({ field: "bids.estimate_file_url" })
    );
  });

  // ── conditional: mandatory walk ──

  it("allows when walk mandatory AND completed", () => {
    const opp = makeOppWithBids(allGatesPass.oppOverrides, {
      ...allGatesPass.bidsOverrides,
      prebid_walk_mandatory: true,
      prebid_walk_completed: true,
    });
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(true);
  });

  it("blocks when walk mandatory AND NOT completed", () => {
    const opp = makeOppWithBids(allGatesPass.oppOverrides, {
      ...allGatesPass.bidsOverrides,
      prebid_walk_mandatory: true,
      prebid_walk_completed: false,
    });
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(false);
    expect(result.unmet).toContainEqual(
      expect.objectContaining({ field: "bids.prebid_walk_completed" })
    );
  });

  it("allows when walk NOT mandatory even if not completed", () => {
    const opp = makeOppWithBids(allGatesPass.oppOverrides, {
      ...allGatesPass.bidsOverrides,
      prebid_walk_mandatory: false,
      prebid_walk_completed: false,
    });
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(true);
  });

  // ── conditional: bond ──

  it("allows when bond required AND arranged", () => {
    const opp = makeOppWithBids(allGatesPass.oppOverrides, {
      ...allGatesPass.bidsOverrides,
      bond_required: true,
      bond_arranged: true,
    });
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(true);
  });

  it("blocks when bond required AND NOT arranged", () => {
    const opp = makeOppWithBids(allGatesPass.oppOverrides, {
      ...allGatesPass.bidsOverrides,
      bond_required: true,
      bond_arranged: false,
    });
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(false);
    expect(result.unmet).toContainEqual(
      expect.objectContaining({ field: "bids.bond_arranged" })
    );
  });

  it("allows when bond NOT required even if not arranged", () => {
    const opp = makeOppWithBids(allGatesPass.oppOverrides, {
      ...allGatesPass.bidsOverrides,
      bond_required: false,
      bond_arranged: false,
    });
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(true);
  });

  it("returns ALL unmet when everything fails", () => {
    const opp = makeOppWithBids(
      { stage: "ESTIMATING", amount: null },
      {
        addenda_acknowledged: false,
        estimate_file_url: null,
        prebid_walk_mandatory: true,
        prebid_walk_completed: false,
        bond_required: true,
        bond_arranged: false,
      }
    );
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(false);
    expect(result.unmet).toHaveLength(5);
  });
});

// ── SUBMITTED → AWARDED / LOST ─────────────────────────────────────

describe("PUBLIC_BID: SUBMITTED → AWARDED", () => {
  it("allows when bid_due_at is in the past", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const opp = makeOppWithBids(
      { stage: "SUBMITTED" },
      { bid_due_at: pastDate }
    );
    const result = canAdvance(opp, "AWARDED");
    expect(result.allowed).toBe(true);
  });

  it("blocks when bid_due_at is in the future", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const opp = makeOppWithBids(
      { stage: "SUBMITTED" },
      { bid_due_at: futureDate }
    );
    const result = canAdvance(opp, "AWARDED");
    expect(result.allowed).toBe(false);
    expect(result.unmet).toContainEqual(
      expect.objectContaining({ field: "bids.bid_due_at" })
    );
  });

  it("blocks when bid_due_at is null", () => {
    const opp = makeOppWithBids(
      { stage: "SUBMITTED" },
      { bid_due_at: null }
    );
    const result = canAdvance(opp, "AWARDED");
    expect(result.allowed).toBe(false);
  });
});

describe("PUBLIC_BID: SUBMITTED → LOST", () => {
  it("uses same gate as AWARDED (bid_due_at passed)", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const opp = makeOppWithBids(
      { stage: "SUBMITTED" },
      { bid_due_at: pastDate }
    );
    const result = canAdvance(opp, "LOST");
    expect(result.allowed).toBe(true);
  });
});

// ── stage skipping ──────────────────────────────────────────────────

describe("stage transition validation", () => {
  it("rejects skipping stages (SOURCED → SUBMITTED)", () => {
    const opp = makeOppWithBids(
      { stage: "SOURCED" },
      { plans_link: "x", go_no_go: true }
    );
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(false);
    expect(result.unmet[0].field).toBe("stage");
  });

  it("rejects going backwards (ESTIMATING → SOURCED)", () => {
    const opp = makeOppWithBids({ stage: "ESTIMATING" }, {});
    const result = canAdvance(opp, "SOURCED");
    expect(result.allowed).toBe(false);
    expect(result.unmet[0].field).toBe("stage");
  });

  it("rejects advancing from a terminal stage (AWARDED → anything)", () => {
    const opp = makeOppWithBids({ stage: "AWARDED" }, {});
    const result = canAdvance(opp, "SUBMITTED");
    expect(result.allowed).toBe(false);
  });
});

// ── disqualification ────────────────────────────────────────────────

describe("isDisqualified (pre-bid walk red-flag)", () => {
  it("returns true when mandatory walk is past and not completed", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const opp = makeOppWithBids(
      {},
      {
        prebid_walk_mandatory: true,
        prebid_walk_at: pastDate,
        prebid_walk_completed: false,
      }
    );
    expect(isDisqualified(opp)).toBe(true);
  });

  it("returns false when mandatory walk is past but completed", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const opp = makeOppWithBids(
      {},
      {
        prebid_walk_mandatory: true,
        prebid_walk_at: pastDate,
        prebid_walk_completed: true,
      }
    );
    expect(isDisqualified(opp)).toBe(false);
  });

  it("returns false when walk is not mandatory", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const opp = makeOppWithBids(
      {},
      {
        prebid_walk_mandatory: false,
        prebid_walk_at: pastDate,
        prebid_walk_completed: false,
      }
    );
    expect(isDisqualified(opp)).toBe(false);
  });

  it("returns false when mandatory walk is in the future", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const opp = makeOppWithBids(
      {},
      {
        prebid_walk_mandatory: true,
        prebid_walk_at: futureDate,
        prebid_walk_completed: false,
      }
    );
    expect(isDisqualified(opp)).toBe(false);
  });

  it("returns false when prebid_walk_at is null", () => {
    const opp = makeOppWithBids(
      {},
      {
        prebid_walk_mandatory: true,
        prebid_walk_at: null,
        prebid_walk_completed: false,
      }
    );
    expect(isDisqualified(opp)).toBe(false);
  });
});
