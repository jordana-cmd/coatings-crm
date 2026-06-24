import { canAdvance } from "../../lib/gates/engine";
import { STAGE_LABELS, PUBLIC_BID_ACTIVE, GC_CHASE_ACTIVE, FACILITY_ACTIVE } from "../../lib/pipelines";
import type { Pipeline } from "../../lib/pipelines";
import type { OppWithBids } from "../../lib/gates/types";

interface Props {
  opp: OppWithBids;
  onAdvance: (targetStage: string) => Promise<void>;
  advancing: boolean;
  advanceError: string | null;
}

function getNextStage(pipeline: Pipeline, currentStage: string): string | null {
  const active: readonly string[] =
    pipeline === "PUBLIC_BID"
      ? PUBLIC_BID_ACTIVE
      : pipeline === "GC_CHASE"
        ? GC_CHASE_ACTIVE
        : FACILITY_ACTIVE;

  const idx = active.indexOf(currentStage);
  if (idx === -1) return null;
  if (idx + 1 < active.length) return active[idx + 1];

  // Last active stage — next is the first terminal
  if (pipeline === "PUBLIC_BID") return "AWARDED";
  return "WON";
}

export default function GateChecklist({ opp, onAdvance, advancing, advanceError }: Props) {
  const pipeline = opp.pipeline as Pipeline;
  const nextStage = getNextStage(pipeline, opp.stage);

  // Terminal stages have no next
  if (!nextStage) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-center text-sm text-gray-500">
        This opportunity has reached a terminal stage.
      </div>
    );
  }

  // SUBMITTED is special: can go to AWARDED or LOST
  const isSubmitted = opp.stage === "SUBMITTED" && pipeline === "PUBLIC_BID";

  // For SUBMITTED, check the gate against AWARDED (same gate for LOST)
  const gateTarget = isSubmitted ? "AWARDED" : nextStage;

  let result;
  try {
    result = canAdvance(opp, gateTarget);
  } catch {
    return (
      <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 text-center text-sm text-yellow-700">
        Gate engine not yet implemented for this pipeline.
      </div>
    );
  }

  const nextLabel = STAGE_LABELS[nextStage] ?? nextStage;

  return (
    <div className="rounded-xl bg-white border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        {isSubmitted ? "Bid Result" : `Advance to ${nextLabel}`}
      </h3>

      {result.allowed ? (
        <>
          <p className="text-green-600 text-sm mb-3 font-medium">
            All conditions met
          </p>

          {advanceError && (
            <p className="text-red-500 text-sm mb-3">{advanceError}</p>
          )}

          {isSubmitted ? (
            <div className="flex gap-2">
              <button
                onClick={() => onAdvance("AWARDED")}
                disabled={advancing}
                className="flex-1 rounded-lg bg-green-600 text-white py-3 text-base font-medium
                           active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {advancing ? "..." : "Mark Awarded"}
              </button>
              <button
                onClick={() => onAdvance("LOST")}
                disabled={advancing}
                className="flex-1 rounded-lg bg-red-600 text-white py-3 text-base font-medium
                           active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {advancing ? "..." : "Mark Lost"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAdvance(nextStage)}
              disabled={advancing}
              className="w-full rounded-lg bg-green-600 text-white py-3 text-base font-medium
                         active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {advancing ? "Advancing..." : `Advance to ${nextLabel}`}
            </button>
          )}
        </>
      ) : (
        <>
          <ul className="space-y-2 mb-3">
            {result.unmet.map((c) => (
              <li key={c.field} className="flex items-start gap-2 text-sm">
                <span className="text-red-500 mt-0.5 shrink-0">✗</span>
                <span className="text-gray-700">{c.label}</span>
              </li>
            ))}
          </ul>
          <button
            disabled
            className="w-full rounded-lg bg-gray-300 text-gray-500 py-3 text-base font-medium
                       cursor-not-allowed"
          >
            Resolve {result.unmet.length} condition{result.unmet.length > 1 ? "s" : ""} to advance
          </button>
        </>
      )}
    </div>
  );
}
