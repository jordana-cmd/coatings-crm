import type { Database } from "../database.types";

export type OppRow = Database["public"]["Tables"]["opportunities"]["Row"];
export type BidsRow = Database["public"]["Tables"]["bids"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];

export type Urgency = "overdue" | "due_today" | "due_soon" | "upcoming" | "none";

export interface NextAction {
  action: string;
  dueDate: string; // ISO date (YYYY-MM-DD)
  source: "manual" | "auto";
  urgency: Urgency;
}

/** An opportunity with its bids extension (for milestone dates). */
export interface OppForCadence extends OppRow {
  bids: BidsRow | null;
  lastContactedAt: string | null; // most recent activity/note timestamp
}

/** A favorited contact with derived last-contacted info. */
export interface ContactForCadence extends ContactRow {
  lastContactedAt: string | null;
}

export interface TouchListItem {
  type: "opp" | "contact";
  id: string;
  name: string;
  companyName: string | null;
  pipeline: string | null; // null for contacts
  stage: string | null; // opp stage; null for contacts
  lastContactedAt: string | null;
  nextAction: NextAction;
}
