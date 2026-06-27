import { describe, it, expect } from "vitest";
import { resolveOppNextAction, resolveContactNextAction, computeUrgency } from "./resolve";
import type { OppForCadence, ContactForCadence } from "./types";
import type { Database } from "../database.types";

type OppRow = Database["public"]["Tables"]["opportunities"]["Row"];
type BidsRow = Database["public"]["Tables"]["bids"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];

// ── helpers ──

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeOpp(overrides: Partial<OppRow> = {}): OppRow {
  return {
    id: "opp-1", name: "Test Opp", pipeline: "PUBLIC_BID", stage: "SOURCED",
    amount: null, owner_id: "user-1", company_id: "co-1",
    job_site_address: "123 Main St", job_site_lat: null, job_site_lng: null,
    project_tag: null, prevailing_wage: null, status: "OPEN",
    lost_reason: null, revisit_date: null, completed_at: null,
    completion_notes: null, final_value: null, expected_close_date: null,
    win_probability: null, stage_entered_at: null, next_step: null,
    next_step_date: null, priority: null, competitor: null,
    created_at: new Date().toISOString(), updated_at: null,
    ...overrides,
  };
}

function makeBids(overrides: Partial<BidsRow> = {}): BidsRow {
  return {
    id: "bid-1", opportunity_id: "opp-1", bid_due_at: null,
    prebid_walk_at: null, prebid_walk_mandatory: false,
    prebid_walk_completed: false, plans_link: null,
    addenda_acknowledged: false, bond_required: false, bond_amount: null,
    bond_arranged: false, estimate_file_url: null, gc_company_id: null,
    gc_carried_us: null, bid_tab_position: null, low_bid_amount: null,
    go_no_go: false, invited: false, quote_delivered: false,
    sub_po_received: false, gc_bid_date: null, expected_award_date: null,
    ...overrides,
  };
}

function makeOppForCadence(
  oppOverrides: Partial<OppRow> = {},
  bidsOverrides: Partial<BidsRow> | null = {},
  lastContactedAt: string | null = null
): OppForCadence {
  return {
    ...makeOpp(oppOverrides),
    bids: bidsOverrides !== null ? makeBids(bidsOverrides) : null,
    lastContactedAt,
  };
}

function makeContact(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    id: "ct-1", company_id: "co-1", name: "Test Contact",
    role: "PM", phone: "(555) 555-5555", email: null,
    is_decision_maker: false, is_favorite: true, linkedin_url: null,
    title: null, city: null, state: null, archived_at: null,
    created_at: new Date().toISOString(),
    next_action: null, next_action_date: null,
    ...overrides,
  };
}

function makeContactForCadence(
  overrides: Partial<ContactRow> = {},
  lastContactedAt: string | null = null
): ContactForCadence {
  return { ...makeContact(overrides), lastContactedAt };
}

// ── computeUrgency ──

describe("computeUrgency", () => {
  it("returns overdue for past dates", () => {
    expect(computeUrgency(daysFromNow(-1))).toBe("overdue");
  });

  it("returns due_today for today", () => {
    expect(computeUrgency(todayStr())).toBe("due_today");
  });

  it("returns due_soon for dates within DUE_SOON_DAYS", () => {
    expect(computeUrgency(daysFromNow(2))).toBe("due_soon");
  });

  it("returns upcoming for dates beyond DUE_SOON_DAYS", () => {
    expect(computeUrgency(daysFromNow(10))).toBe("upcoming");
  });
});

// ── Opportunity: manual overrides auto ──

describe("resolveOppNextAction: manual override", () => {
  it("uses manual next_step + next_step_date when both set", () => {
    const opp = makeOppForCadence({
      pipeline: "GC_CHASE",
      next_step: "Call John",
      next_step_date: daysFromNow(2),
    }, null, null);

    const result = resolveOppNextAction(opp)!;
    expect(result.source).toBe("manual");
    expect(result.action).toBe("Call John");
    expect(result.dueDate).toBe(daysFromNow(2));
  });

  it("falls to auto when next_step set but next_step_date is null", () => {
    const opp = makeOppForCadence({
      pipeline: "GC_CHASE",
      next_step: "Call John",
      next_step_date: null,
    }, null, null);

    const result = resolveOppNextAction(opp)!;
    expect(result.source).toBe("auto");
  });
});

// ── Opportunity: returns null for non-OPEN ──

describe("resolveOppNextAction: status filter", () => {
  it("returns null for WON opps", () => {
    const opp = makeOppForCadence({ status: "WON" });
    expect(resolveOppNextAction(opp)).toBeNull();
  });

  it("returns null for LOST opps", () => {
    const opp = makeOppForCadence({ status: "LOST" });
    expect(resolveOppNextAction(opp)).toBeNull();
  });
});

// ── PUBLIC_BID: hard-bid milestone dates ──

describe("resolveOppNextAction: PUBLIC_BID milestones", () => {
  it("returns nearest upcoming milestone (bid_due_at)", () => {
    const opp = makeOppForCadence(
      { pipeline: "PUBLIC_BID" },
      { bid_due_at: daysFromNow(5) + "T17:00:00Z" }
    );
    const result = resolveOppNextAction(opp)!;
    expect(result.source).toBe("auto");
    expect(result.action).toBe("Bid due");
    expect(result.urgency).toBe("upcoming");
  });

  it("returns prebid walk when it's sooner than bid due", () => {
    const opp = makeOppForCadence(
      { pipeline: "PUBLIC_BID" },
      {
        prebid_walk_at: daysFromNow(2) + "T10:00:00Z",
        bid_due_at: daysFromNow(10) + "T17:00:00Z",
      }
    );
    const result = resolveOppNextAction(opp)!;
    expect(result.action).toBe("Pre-bid walk");
  });

  it("returns null when no milestone dates exist", () => {
    const opp = makeOppForCadence({ pipeline: "PUBLIC_BID" }, {});
    expect(resolveOppNextAction(opp)).toBeNull();
  });

  it("marks overdue milestones", () => {
    const opp = makeOppForCadence(
      { pipeline: "PUBLIC_BID" },
      { bid_due_at: daysAgo(2) }
    );
    const result = resolveOppNextAction(opp)!;
    expect(result.urgency).toBe("overdue");
  });
});

// ── GC_CHASE: drip at 21-day boundary ──

describe("resolveOppNextAction: GC_CHASE drip", () => {
  it("fires overdue when last contact > 21 days ago", () => {
    const opp = makeOppForCadence(
      { pipeline: "GC_CHASE" }, null, daysAgo(25)
    );
    const result = resolveOppNextAction(opp)!;
    expect(result.source).toBe("auto");
    expect(result.urgency).toBe("overdue");
    expect(result.action).toContain("GC has gone quiet");
    expect(result.action).toContain("25d");
  });

  it("fires due_today when never contacted", () => {
    const opp = makeOppForCadence(
      { pipeline: "GC_CHASE" }, null, null
    );
    const result = resolveOppNextAction(opp)!;
    expect(result.urgency).toBe("due_today");
    expect(result.action).toContain("never contacted");
  });

  it("returns upcoming when last contact < 21 days ago", () => {
    const opp = makeOppForCadence(
      { pipeline: "GC_CHASE" }, null, daysAgo(5)
    );
    const result = resolveOppNextAction(opp)!;
    expect(result.source).toBe("auto");
    expect(result.urgency).toBe("upcoming");
    expect(result.dueDate).toBe(daysFromNow(16));
  });

  it("fires exactly at 21 days", () => {
    const opp = makeOppForCadence(
      { pipeline: "GC_CHASE" }, null, daysAgo(21)
    );
    const result = resolveOppNextAction(opp)!;
    expect(result.urgency).toBe("overdue");
  });
});

// ── FACILITY: nurture at 45-day boundary ──

describe("resolveOppNextAction: FACILITY nurture", () => {
  it("fires overdue when last contact > 45 days ago", () => {
    const opp = makeOppForCadence(
      { pipeline: "FACILITY" }, null, daysAgo(50)
    );
    const result = resolveOppNextAction(opp)!;
    expect(result.source).toBe("auto");
    expect(result.urgency).toBe("overdue");
    expect(result.action).toContain("facility nurture");
    expect(result.action).toContain("50d");
  });

  it("returns upcoming when last contact < 45 days ago", () => {
    const opp = makeOppForCadence(
      { pipeline: "FACILITY" }, null, daysAgo(10)
    );
    const result = resolveOppNextAction(opp)!;
    expect(result.urgency).toBe("upcoming");
    expect(result.dueDate).toBe(daysFromNow(35));
  });
});

// ── Contact: manual overrides auto ──

describe("resolveContactNextAction: manual override", () => {
  it("uses manual next_action + next_action_date when set", () => {
    const c = makeContactForCadence({
      next_action: "Send proposal",
      next_action_date: daysFromNow(1),
    }, daysAgo(5));

    const result = resolveContactNextAction(c)!;
    expect(result.source).toBe("manual");
    expect(result.action).toBe("Send proposal");
  });

  it("falls to auto when manual fields are null", () => {
    const c = makeContactForCadence({}, daysAgo(35));
    const result = resolveContactNextAction(c)!;
    expect(result.source).toBe("auto");
    expect(result.action).toContain("35d");
  });
});

// ── Contact: only favorited contacts ──

describe("resolveContactNextAction: favorites only", () => {
  it("returns null for non-favorited contacts", () => {
    const c = makeContactForCadence({ is_favorite: false }, null);
    expect(resolveContactNextAction(c)).toBeNull();
  });

  it("returns action for favorited contacts", () => {
    const c = makeContactForCadence({ is_favorite: true }, null);
    const result = resolveContactNextAction(c)!;
    expect(result).not.toBeNull();
    expect(result.action).toContain("never contacted");
  });
});

// ── Contact: drip at 30-day boundary ──

describe("resolveContactNextAction: drip cadence", () => {
  it("fires overdue when last contact > 30 days ago", () => {
    const c = makeContactForCadence({}, daysAgo(35));
    const result = resolveContactNextAction(c)!;
    expect(result.urgency).toBe("overdue");
    expect(result.action).toContain("35d");
  });

  it("returns upcoming when last contact < 30 days ago", () => {
    const c = makeContactForCadence({}, daysAgo(10));
    const result = resolveContactNextAction(c)!;
    expect(result.urgency).toBe("upcoming");
    expect(result.dueDate).toBe(daysFromNow(20));
  });

  it("fires due_today when never contacted", () => {
    const c = makeContactForCadence({}, null);
    const result = resolveContactNextAction(c)!;
    expect(result.urgency).toBe("due_today");
    expect(result.dueDate).toBe(todayStr());
  });
});
