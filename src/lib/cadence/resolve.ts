/**
 * Cadence engine — resolves the next action for opps and contacts.
 * Single source of truth, computed at read time (never persisted for auto).
 * Mirrors the gates pattern: pure functions, no side effects.
 */

import {
  GC_CHASE_DAYS,
  FACILITY_NURTURE_DAYS,
  CONTACT_DRIP_DAYS,
  DUE_SOON_DAYS,
} from "./constants";
import type {
  NextAction,
  Urgency,
  OppForCadence,
  ContactForCadence,
} from "./types";

// ── Helpers ──

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function computeUrgency(dueDate: string): Urgency {
  const now = today();
  if (dueDate < now) return "overdue";
  if (dueDate === now) return "due_today";
  const soon = new Date();
  soon.setDate(soon.getDate() + DUE_SOON_DAYS);
  if (dueDate <= soon.toISOString().slice(0, 10)) return "due_soon";
  return "upcoming";
}

function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Opportunity resolver ──

function autoForPublicBid(opp: OppForCadence): NextAction | null {
  if (!opp.bids) return null;

  // Collect upcoming milestone dates
  const milestones: { action: string; date: string }[] = [];
  const t = today();

  if (opp.bids.prebid_walk_at) {
    const d = opp.bids.prebid_walk_at.slice(0, 10);
    if (d >= t || !opp.bids.prebid_walk_completed) {
      milestones.push({ action: "Pre-bid walk", date: d });
    }
  }
  if (opp.bids.bid_due_at) {
    const d = opp.bids.bid_due_at.slice(0, 10);
    milestones.push({ action: "Bid due", date: d });
  }
  if (opp.bids.expected_award_date) {
    const d = opp.bids.expected_award_date;
    milestones.push({ action: "Award expected", date: d });
  }

  if (milestones.length === 0) return null;

  // Pick nearest upcoming (or most recently overdue)
  milestones.sort((a, b) => a.date.localeCompare(b.date));
  // Prefer the nearest future or today milestone; if all past, use the latest
  const upcoming = milestones.find((m) => m.date >= t) ?? milestones[milestones.length - 1];

  return {
    action: upcoming.action,
    dueDate: upcoming.date,
    source: "auto",
    urgency: computeUrgency(upcoming.date),
  };
}

function autoForFederal(opp: OppForCadence): NextAction | null {
  if (!opp.federalDetails) return null;

  const milestones: { action: string; date: string }[] = [];
  const t = today();

  if (opp.federalDetails.site_visit_date) {
    const d = new Date(opp.federalDetails.site_visit_date).toISOString().slice(0, 10);
    if (d >= t || !opp.federalDetails.site_visit_completed) {
      milestones.push({ action: "Site visit", date: d });
    }
  }
  if (opp.federalDetails.response_deadline) {
    const d = new Date(opp.federalDetails.response_deadline).toISOString().slice(0, 10);
    milestones.push({ action: "Response deadline", date: d });
  }

  if (milestones.length === 0) return null;

  milestones.sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = milestones.find((m) => m.date >= t) ?? milestones[milestones.length - 1];

  return {
    action: upcoming.action,
    dueDate: upcoming.date,
    source: "auto",
    urgency: computeUrgency(upcoming.date),
  };
}

function autoForDrip(opp: OppForCadence, thresholdDays: number, motionLabel: string): NextAction | null {
  const days = daysSince(opp.lastContactedAt);

  if (days === null) {
    // Never contacted — due now
    return {
      action: `Touch — ${motionLabel} (never contacted)`,
      dueDate: today(),
      source: "auto",
      urgency: "due_today",
    };
  }

  if (days >= thresholdDays) {
    return {
      action: `Touch — ${motionLabel} (${days}d since last contact)`,
      dueDate: today(),
      source: "auto",
      urgency: "overdue",
    };
  }

  // Not yet due — compute when it will be
  const dueDate = addDays(opp.lastContactedAt!, thresholdDays);
  return {
    action: `Follow up — ${motionLabel}`,
    dueDate,
    source: "auto",
    urgency: computeUrgency(dueDate),
  };
}

export function resolveOppNextAction(opp: OppForCadence): NextAction | null {
  // Only OPEN opps get next actions
  if (opp.status !== "OPEN") return null;

  // MANUAL WINS
  if (opp.next_step && opp.next_step_date) {
    return {
      action: opp.next_step,
      dueDate: opp.next_step_date,
      source: "manual",
      urgency: computeUrgency(opp.next_step_date),
    };
  }

  // AUTO by pipeline motion
  switch (opp.pipeline) {
    case "PUBLIC_BID":
      return autoForPublicBid(opp);
    case "GC_CHASE":
      return autoForDrip(opp, GC_CHASE_DAYS, "GC has gone quiet");
    case "FACILITY":
      return autoForDrip(opp, FACILITY_NURTURE_DAYS, "facility nurture");
    case "FEDERAL":
      return autoForFederal(opp);
    default:
      return null;
  }
}

// ── Contact resolver ──

export function resolveContactNextAction(contact: ContactForCadence): NextAction | null {
  // Only favorited contacts participate
  if (!contact.is_favorite) return null;

  // MANUAL WINS
  if (contact.next_action && contact.next_action_date) {
    return {
      action: contact.next_action,
      dueDate: contact.next_action_date,
      source: "manual",
      urgency: computeUrgency(contact.next_action_date),
    };
  }

  // AUTO: drip based on last contacted
  const days = daysSince(contact.lastContactedAt);

  if (days === null) {
    return {
      action: "Introduce yourself — never contacted",
      dueDate: today(),
      source: "auto",
      urgency: "due_today",
    };
  }

  if (days >= CONTACT_DRIP_DAYS) {
    return {
      action: `Check in — ${days}d since last contact`,
      dueDate: today(),
      source: "auto",
      urgency: "overdue",
    };
  }

  const dueDate = addDays(contact.lastContactedAt!, CONTACT_DRIP_DAYS);
  return {
    action: "Follow up",
    dueDate,
    source: "auto",
    urgency: computeUrgency(dueDate),
  };
}

// ── Urgency sort order (for touch list sorting) ──

const URGENCY_ORDER: Record<Urgency, number> = {
  overdue: 0,
  due_today: 1,
  due_soon: 2,
  upcoming: 3,
  none: 4,
};

export function compareByUrgency(a: NextAction, b: NextAction): number {
  const diff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
  if (diff !== 0) return diff;
  return a.dueDate.localeCompare(b.dueDate);
}
