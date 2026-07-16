import type { Pipeline } from "./pipelines";

// The stage-history transition that counts as "we submitted our number" per
// pipeline. PUBLIC_BID has an explicit SUBMITTED stage; GC_CHASE/FACILITY
// don't, so CARRIED/PROPOSAL stand in as their closest equivalent.
export const SUBMITTED_STAGE_BY_PIPELINE: Record<Pipeline, string> = {
  PUBLIC_BID: "SUBMITTED",
  GC_CHASE: "CARRIED",
  FACILITY: "PROPOSAL",
};

export const ALL_SUBMITTED_STAGES = Object.values(SUBMITTED_STAGE_BY_PIPELINE);
