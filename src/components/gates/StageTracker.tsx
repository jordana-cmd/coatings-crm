import { stagesFor, STAGE_LABELS } from "../../lib/pipelines";
import type { Pipeline } from "../../lib/pipelines";
import type { OppWithBids } from "../../lib/gates/types";
import { isDisqualified } from "../../lib/gates/disqualification";

interface Props {
  opp: OppWithBids;
}

export default function StageTracker({ opp }: Props) {
  if (opp.pipeline === "PUBLIC_BID" && isDisqualified(opp)) {
    return (
      <div className="rounded-xl bg-red-50 border-2 border-red-300 p-4 text-center">
        <p className="text-red-700 font-bold text-lg">DISQUALIFIED</p>
        <p className="text-red-600 text-sm mt-1">
          Mandatory pre-bid walk missed — cannot bid
        </p>
      </div>
    );
  }

  const pipeline = opp.pipeline as Pipeline;
  const allStages = stagesFor(pipeline).filter(
    (s) => s !== "LOST" && s !== "NURTURE"
  );
  const currentIdx = allStages.indexOf(opp.stage);
  const isTerminal = opp.stage === "LOST" || opp.stage === "NURTURE";

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {allStages.map((stage, idx) => {
        let bg: string;
        let text: string;

        if (isTerminal) {
          bg = "bg-gray-100";
          text = "text-gray-400";
        } else if (idx < currentIdx) {
          bg = "bg-green-100";
          text = "text-green-700";
        } else if (idx === currentIdx) {
          bg = "bg-gray-900";
          text = "text-white";
        } else {
          bg = "bg-gray-100";
          text = "text-gray-400";
        }

        return (
          <div
            key={stage}
            className={`${bg} ${text} rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0`}
          >
            {STAGE_LABELS[stage] ?? stage}
          </div>
        );
      })}

      {isTerminal && (
        <div
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
            opp.stage === "LOST"
              ? "bg-red-100 text-red-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {STAGE_LABELS[opp.stage] ?? opp.stage}
        </div>
      )}
    </div>
  );
}
