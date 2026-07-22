import { stagesFor, STAGE_LABELS } from "../../lib/pipelines";
import type { Pipeline } from "../../lib/pipelines";
import type { OppRow, BidsRow, OppWithBids } from "../../lib/gates/types";
import { isDisqualified } from "../../lib/gates/disqualification";

interface Props {
  opp: OppRow & { bids?: BidsRow | null };
}

export default function StageTracker({ opp }: Props) {
  if (opp.pipeline === "PUBLIC_BID" && opp.bids && isDisqualified(opp as OppWithBids)) {
    return (
      <div className="rounded-xl bg-dq-bg border-2 border-dq-border p-4 text-center">
        <p className="text-dq font-bold text-lg">DISQUALIFIED</p>
        <p className="text-dq/70 text-sm mt-1">Mandatory pre-bid walk missed — cannot bid</p>
      </div>
    );
  }

  const pipeline = opp.pipeline as Pipeline;
  const allStages = stagesFor(pipeline).filter((s) => s !== "LOST");
  const currentIdx = allStages.indexOf(opp.stage);
  const isTerminal = opp.stage === "LOST";

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {allStages.map((stage, idx) => {
        let bg: string;
        let text: string;
        if (isTerminal) { bg = "bg-gray-100"; text = "text-subtle"; }
        else if (idx < currentIdx) { bg = "bg-gate-met-light"; text = "text-gate-met"; }
        else if (idx === currentIdx) { bg = "bg-brand"; text = "text-white"; }
        else { bg = "bg-gray-100"; text = "text-subtle"; }
        return (
          <div key={stage} className={`${bg} ${text} rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0`}>
            {STAGE_LABELS[stage] ?? stage}
          </div>
        );
      })}
      {isTerminal && (
        <div className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
          opp.stage === "LOST" ? "bg-dq-bg text-dq border border-dq-border" : "bg-pending-light text-pending"
        }`}>
          {STAGE_LABELS[opp.stage] ?? opp.stage}
        </div>
      )}
    </div>
  );
}
