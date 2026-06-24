import type { GateResult, OppForGates, OppWithBids } from "./types";
import { getPublicBidGate } from "./public-bid";
import { PUBLIC_BID_ACTIVE, GC_CHASE_ACTIVE, FACILITY_ACTIVE } from "../pipelines";
import type { Pipeline } from "../pipelines";

/**
 * Ordered active (non-terminal) stages per pipeline.
 * Used to validate that targetStage is the legal next stage.
 */
const ACTIVE_STAGES: Record<Pipeline, readonly string[]> = {
  PUBLIC_BID: PUBLIC_BID_ACTIVE,
  GC_CHASE: GC_CHASE_ACTIVE,
  FACILITY: FACILITY_ACTIVE,
};

/** Terminal outcome stages that can be reached from the last active stage. */
const TERMINAL_FROM: Record<Pipeline, Record<string, string[]>> = {
  PUBLIC_BID: { SUBMITTED: ["AWARDED", "LOST"] },
  GC_CHASE: { GC_AWARDED: ["WON", "LOST"] },
  FACILITY: { APPROVAL: ["WON", "LOST", "NURTURE"] },
};

function isValidTransition(
  pipeline: Pipeline,
  currentStage: string,
  targetStage: string
): boolean {
  const active = ACTIVE_STAGES[pipeline];
  const currentIdx = active.indexOf(currentStage);

  // Current stage must be in the active set
  if (currentIdx === -1) return false;

  // Check if target is the next active stage
  if (currentIdx + 1 < active.length && active[currentIdx + 1] === targetStage) {
    return true;
  }

  // Check if target is a terminal outcome from the current stage
  const terminals = TERMINAL_FROM[pipeline][currentStage];
  if (terminals && terminals.includes(targetStage)) {
    return true;
  }

  return false;
}

/**
 * canAdvance — the single gate engine entry point.
 *
 * Validates the transition is legal (no stage skipping), then runs the
 * pipeline-specific gate predicates.
 *
 * CRITICAL: When PUBLIC_BID reaches AWARDED, the caller MUST also set
 * status = WON. The gate engine does not mutate data — the advance
 * handler that calls this function is responsible for the status update.
 */
export function canAdvance(opp: OppForGates, targetStage: string): GateResult {
  const pipeline = opp.pipeline as Pipeline;

  if (!isValidTransition(pipeline, opp.stage, targetStage)) {
    return {
      allowed: false,
      unmet: [
        {
          field: "stage",
          label: `Cannot advance from ${opp.stage} to ${targetStage}`,
        },
      ],
    };
  }

  switch (pipeline) {
    case "PUBLIC_BID": {
      const gate = getPublicBidGate(opp.stage, targetStage);
      if (!gate) {
        return { allowed: true, unmet: [] };
      }
      return gate(opp as OppWithBids);
    }
    case "GC_CHASE":
      throw new Error("GC_CHASE gate predicates not yet implemented");
    case "FACILITY":
      throw new Error("FACILITY gate predicates not yet implemented");
  }
}
