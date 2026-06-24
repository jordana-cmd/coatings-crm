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

  if (pipeline === "PUBLIC_BID") return "AWARDED";
  return "WON";
}

export default function GateChecklist({ opp, onAdvance, advancing, advanceError }: Props) {
  const pipeline = opp.pipeline as Pipeline;
  const nextStage = getNextStage(pipeline, opp.stage);

  if (!nextStage) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-center text-sm text-text-muted">
        This opportunity has reached a terminal stage.
      </div>
    );
  }

  const isSubmitted = opp.stage === "SUBMITTED" && pipeline === "PUBLIC_BID";
  const gateTarget = isSubmitted ? "AWARDED" : nextStage;

  let result;
  try {
    result = canAdvance(opp, gateTarget);
  } catch {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center text-sm text-pending">
        Gate engine not yet implemented for this pipeline.
      </div>
    );
  }

  const nextLabel = STAGE_LABELS[nextStage] ?? nextStage;

  return (
    <div className="rounded-xl bg-surface border border-gray-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        {isSubmitted ? "Bid Result" : `Advance to ${nextLabel}`}
      </h3>

      {result.allowed ? (
        <>
          <p className="text-gate-met text-sm mb-3 font-medium">
            All conditions met
          </p>

          {advanceError && (
            <p className="text-brand text-sm mb-3">{advanceError}</p>
          )}

          {isSubmitted ? (
            <div className="flex gap-2">
              <button
                onClick={() => onAdvance("AWARDED")}
                disabled={advancing}
                className="flex-1 rounded-lg bg-gate-met text-white py-3 text-base font-medium
                           active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {advancing ? "..." : "Mark Awarded"}
              </button>
              <button
                onClick={() => onAdvance("LOST")}
                disabled={advancing}
                className="flex-1 rounded-lg bg-dq text-white py-3 text-base font-medium
                           active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {advancing ? "..." : "Mark Lost"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAdvance(nextStage)}
              disabled={advancing}
              className="w-full rounded-lg bg-brand text-white py-3 text-base font-medium
                         active:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
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
                <span className="text-dq mt-0.5 shrink-0">&#x2717;</span>
                <span className="text-text-muted">{c.label}</span>
              </li>
            ))}
          </ul>
          <button
            disabled
            className="w-full rounded-lg bg-gray-200 text-gate-unmet py-3 text-base font-medium
                       cursor-not-allowed"
          >
            Resolve {result.unmet.length} condition{result.unmet.length > 1 ? "s" : ""} to advance
          </button>
        </>
      )}
    </div>
  );
}
