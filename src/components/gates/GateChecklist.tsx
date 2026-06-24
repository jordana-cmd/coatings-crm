import { canAdvance } from "../../lib/gates/engine";
import { STAGE_LABELS, PUBLIC_BID_ACTIVE, GC_CHASE_ACTIVE, FACILITY_ACTIVE } from "../../lib/pipelines";
import type { Pipeline } from "../../lib/pipelines";
import type { OppWithBids } from "../../lib/gates/types";

interface Props {
  opp: OppWithBids;
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

  // Last active stage — next is the first terminal (AWARDED for PUBLIC_BID, WON for others)
  if (pipeline === "PUBLIC_BID") return "AWARDED";
  return "WON";
}

export default function GateChecklist({ opp }: Props) {
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

  let result;
  try {
    result = canAdvance(opp, nextStage);
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
        Advance to {nextLabel}
      </h3>

      {result.allowed ? (
        <>
          <p className="text-green-600 text-sm mb-3 font-medium">
            All conditions met
          </p>
          <button
            onClick={() => {
              // TODO: advance mutation — next step
            }}
            className="w-full rounded-lg bg-green-600 text-white py-3 text-base font-medium
                       active:bg-green-700"
          >
            Advance to {nextLabel}
          </button>
        </>
      ) : (
        <>
          <ul className="space-y-2 mb-3">
            {result.unmet.map((c) => (
              <li
                key={c.field}
                className="flex items-start gap-2 text-sm"
              >
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
