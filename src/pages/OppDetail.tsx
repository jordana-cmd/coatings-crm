import { useParams, useNavigate } from "react-router-dom";
import { useOpportunity } from "../hooks/useOpportunity";
import { STAGE_LABELS, PIPELINE_LABELS } from "../lib/pipelines";
import type { Pipeline } from "../lib/pipelines";
import StageTracker from "../components/gates/StageTracker";
import GateChecklist from "../components/gates/GateChecklist";

function BoolBadge({ value, label }: { value: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          value
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-400"
        }`}
      >
        {value ? "Yes" : "No"}
      </span>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm text-gray-900 truncate max-w-[55%] text-right">
        {value || "—"}
      </span>
    </div>
  );
}

export default function OppDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: opp, loading, error } = useOpportunity(id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 text-sm mb-4">{error ?? "Not found"}</p>
        <button onClick={() => navigate("/")} className="text-sm text-blue-600">
          &larr; Back to list
        </button>
      </div>
    );
  }

  const bids = opp.bids;

  return (
    <div className="space-y-4 pb-8">
      {/* Back + header */}
      <button
        onClick={() => navigate("/")}
        className="text-sm text-blue-600"
      >
        &larr; Back
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-900">{opp.name}</h1>
        <p className="text-sm text-gray-500">
          {opp.company_name ?? "—"} &middot;{" "}
          {PIPELINE_LABELS[opp.pipeline as Pipeline]} &middot;{" "}
          {STAGE_LABELS[opp.stage] ?? opp.stage}
        </p>
        <p className="text-sm text-gray-400 mt-0.5">{opp.job_site_address}</p>
      </div>

      {/* Stage tracker */}
      <StageTracker opp={opp} />

      {/* Gate checklist */}
      <GateChecklist opp={opp} />

      {/* Bids fields summary */}
      <div className="rounded-xl bg-white border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Bid Details
        </h3>
        <div className="divide-y divide-gray-100">
          <FieldRow
            label="Amount"
            value={opp.amount != null ? `$${opp.amount.toLocaleString()}` : null}
          />
          <FieldRow label="Plans Link" value={bids.plans_link} />
          <BoolBadge value={bids.go_no_go} label="Go / No-Go" />
          <BoolBadge value={bids.addenda_acknowledged} label="Addenda Acknowledged" />
          <FieldRow label="Estimate File" value={bids.estimate_file_url} />
          <FieldRow
            label="Bid Due"
            value={
              bids.bid_due_at
                ? new Date(bids.bid_due_at).toLocaleDateString()
                : null
            }
          />

          {/* Walk */}
          <BoolBadge value={bids.prebid_walk_mandatory} label="Walk Mandatory" />
          {bids.prebid_walk_mandatory && (
            <>
              <FieldRow
                label="Walk Date"
                value={
                  bids.prebid_walk_at
                    ? new Date(bids.prebid_walk_at).toLocaleDateString()
                    : null
                }
              />
              <BoolBadge value={bids.prebid_walk_completed} label="Walk Completed" />
            </>
          )}

          {/* Bond */}
          <BoolBadge value={bids.bond_required} label="Bond Required" />
          {bids.bond_required && (
            <>
              <FieldRow
                label="Bond Amount"
                value={
                  bids.bond_amount != null
                    ? `$${bids.bond_amount.toLocaleString()}`
                    : null
                }
              />
              <BoolBadge value={bids.bond_arranged} label="Bond Arranged" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
