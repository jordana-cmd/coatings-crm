import type { Database } from "./database.types";

export type Pipeline = Database["public"]["Enums"]["pipeline_type"];

// Stage literals — MUST match valid_stage_for_pipeline() in the DB exactly.
// Source of truth: CLAUDE.md "M1 locked decisions → Stage values"

export const PUBLIC_BID_STAGES = [
  "SOURCED",
  "ESTIMATING",
  "SUBMITTED",
  "AWARDED",
  "LOST",
] as const;

export const GC_CHASE_STAGES = [
  "ON_THE_LIST",
  "QUOTING",
  "CARRIED",
  "GC_AWARDED",
  "WON",
  "LOST",
] as const;

export const FACILITY_STAGES = [
  "ENGAGED",
  "SITE_WALK",
  "PROPOSAL",
  "APPROVAL",
  "WON",
  "LOST",
  "NURTURE",
] as const;

export const FEDERAL_STAGES = [
  "INTAKE",
  "EXTRACTION",
  "SCORING",
  "ESTIMATING",
  "SUBMITTED",
  "AWARDED",
  "LOST",
] as const;

export type PublicBidStage = (typeof PUBLIC_BID_STAGES)[number];
export type GcChaseStage = (typeof GC_CHASE_STAGES)[number];
export type FacilityStage = (typeof FACILITY_STAGES)[number];
export type FederalStage = (typeof FEDERAL_STAGES)[number];
export type Stage = PublicBidStage | GcChaseStage | FacilityStage | FederalStage;

// Ordered active stages (excludes terminal outcomes) for pipeline progress bars
export const PUBLIC_BID_ACTIVE = ["SOURCED", "ESTIMATING", "SUBMITTED", "AWARDED"] as const;
export const GC_CHASE_ACTIVE = ["ON_THE_LIST", "QUOTING", "CARRIED", "GC_AWARDED", "WON"] as const;
export const FACILITY_ACTIVE = ["ENGAGED", "SITE_WALK", "PROPOSAL", "APPROVAL", "WON"] as const;
export const FEDERAL_ACTIVE = ["INTAKE", "EXTRACTION", "SCORING", "ESTIMATING", "SUBMITTED", "AWARDED"] as const;

const STAGE_ARRAYS: Record<Pipeline, readonly string[]> = {
  PUBLIC_BID: PUBLIC_BID_STAGES,
  GC_CHASE: GC_CHASE_STAGES,
  FACILITY: FACILITY_STAGES,
  FEDERAL: FEDERAL_STAGES,
};

export function stagesFor(pipeline: Pipeline): readonly string[] {
  return STAGE_ARRAYS[pipeline];
}

// Human-readable labels
export const STAGE_LABELS: Record<string, string> = {
  SOURCED: "Sourced",
  ESTIMATING: "Estimating",
  SUBMITTED: "Submitted",
  AWARDED: "Awarded",
  ON_THE_LIST: "On the List",
  QUOTING: "Quoting",
  CARRIED: "Carried",
  GC_AWARDED: "GC Awarded",
  ENGAGED: "Engaged",
  SITE_WALK: "Site Walk",
  PROPOSAL: "Proposal",
  APPROVAL: "Approval",
  INTAKE: "Intake",
  EXTRACTION: "Extraction",
  SCORING: "Scoring",
  WON: "Won",
  LOST: "Lost",
  NURTURE: "Nurture",
};

export const PIPELINE_LABELS: Record<Pipeline, string> = {
  PUBLIC_BID: "Public Bid",
  GC_CHASE: "GC Chase",
  FACILITY: "Facility",
  FEDERAL: "Federal",
};

// CRITICAL — PUBLIC_BID AWARDED ↔ STATUS coupling:
// PUBLIC_BID's terminal win STAGE is AWARDED, but a win is recorded as
// STATUS = WON. The advance logic (M3 gate engine) MUST set status = WON
// when a PUBLIC_BID opp reaches stage AWARDED. The win-rate dashboard
// reads STATUS, not stage — if this coupling is missed, PUBLIC_BID wins
// never count.
