import type { Pipeline } from "./pipelines";

// The stage-history transition that counts as "we submitted our number" per
// pipeline. PUBLIC_BID, GC_CHASE, and FEDERAL now share an explicit SUBMITTED
// stage; FACILITY has no bid submission, so PROPOSAL stands in.
export const SUBMITTED_STAGE_BY_PIPELINE: Record<Pipeline, string> = {
  PUBLIC_BID: "SUBMITTED",
  GC_CHASE: "SUBMITTED",
  FACILITY: "PROPOSAL",
  FEDERAL: "SUBMITTED",
};

export const ALL_SUBMITTED_STAGES = Object.values(SUBMITTED_STAGE_BY_PIPELINE);
