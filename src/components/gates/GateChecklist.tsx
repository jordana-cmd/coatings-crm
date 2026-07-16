import { canAdvance } from "../../lib/gates/engine";
import { friendlyLabel } from "../../lib/gates/labels";
import { STAGE_LABELS, PUBLIC_BID_ACTIVE, GC_CHASE_ACTIVE, FACILITY_ACTIVE, FEDERAL_ACTIVE } from "../../lib/pipelines";
import type { Pipeline } from "../../lib/pipelines";
import type { OppForGates } from "../../lib/gates/types";
import { CheckCircle2, Circle } from "lucide-react";

interface Props {
  opp: OppForGates;
  onAdvance: (targetStage: string) => Promise<void>;
  advancing: boolean;
  advanceError: string | null;
}

function getNextStage(pipeline: Pipeline, currentStage: string): string | null {
  const active: readonly string[] =
    pipeline === "PUBLIC_BID" ? PUBLIC_BID_ACTIVE
    : pipeline === "GC_CHASE" ? GC_CHASE_ACTIVE
    : pipeline === "FEDERAL" ? FEDERAL_ACTIVE
    : FACILITY_ACTIVE;
  const idx = active.indexOf(currentStage);
  if (idx === -1) return null;
  if (idx + 1 < active.length) return active[idx + 1];
  if (pipeline === "PUBLIC_BID" || pipeline === "FEDERAL") return "AWARDED";
  return "WON";
}

export default function GateChecklist({ opp, onAdvance, advancing, advanceError }: Props) {
  const pipeline = opp.pipeline as Pipeline;
  const nextStage = getNextStage(pipeline, opp.stage);

  if (!nextStage) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-5 text-center text-sm text-label">
        This opportunity has reached a terminal stage.
      </div>
    );
  }

  const isSubmitted =
    opp.stage === "SUBMITTED" && (pipeline === "PUBLIC_BID" || pipeline === "FEDERAL");
  const gateTarget = isSubmitted ? "AWARDED" : nextStage;

  let result;
  try { result = canAdvance(opp, gateTarget); }
  catch {
    return (
      <div className="bg-pending-light rounded-xl p-5 text-center text-sm text-pending">
        Gate engine not yet implemented for this pipeline.
      </div>
    );
  }

  const nextLabel = STAGE_LABELS[nextStage] ?? nextStage;

  return (
    <div className="bg-card rounded-xl shadow-sm p-5">
      <h3 className="text-xs font-semibold text-label uppercase tracking-wide mb-3">
        {isSubmitted ? "Bid Result" : `Advance to ${nextLabel}`}
      </h3>

      {/* Requirements checklist */}
      {result.unmet.length > 0 && (
        <ul className="space-y-2 mb-3">
          {result.unmet.map((c) => (
            <li key={c.field} className="flex items-start gap-2 text-sm">
              <Circle size={16} className="text-pending mt-0.5 shrink-0" />
              <span className="text-label">{friendlyLabel(c.field, c.label)}</span>
            </li>
          ))}
        </ul>
      )}

      {result.allowed ? (
        <>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} className="text-gate-met" />
            <p className="text-gate-met text-sm font-medium">Ready to advance to {nextLabel}</p>
          </div>
          {advanceError && <p className="text-brand text-sm mb-3">{advanceError}</p>}
          {isSubmitted ? (
            <div className="flex gap-2">
              <button onClick={() => onAdvance("AWARDED")} disabled={advancing}
                className="flex-1 rounded-lg bg-gate-met text-white py-3 text-sm font-medium
                           active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed">
                {advancing ? "..." : "Mark Awarded"}
              </button>
              <button onClick={() => onAdvance("LOST")} disabled={advancing}
                className="flex-1 rounded-lg bg-dq text-white py-3 text-sm font-medium
                           active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed">
                {advancing ? "..." : "Mark Lost"}
              </button>
            </div>
          ) : (
            <button onClick={() => onAdvance(nextStage)} disabled={advancing}
              className="w-full rounded-lg bg-brand text-white py-3 text-sm font-medium
                         active:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed">
              {advancing ? "Advancing..." : `Advance to ${nextLabel}`}
            </button>
          )}
        </>
      ) : (
        <button disabled
          className="w-full rounded-lg bg-gray-100 text-subtle py-3 text-sm font-medium cursor-not-allowed">
          Resolve {result.unmet.length} condition{result.unmet.length > 1 ? "s" : ""} to advance
        </button>
      )}
    </div>
  );
}
