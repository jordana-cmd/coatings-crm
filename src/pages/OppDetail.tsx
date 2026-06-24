import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOpportunity } from "../hooks/useOpportunity";
import { useUpdateBids } from "../hooks/useUpdateBids";
import { useAdvanceStage } from "../hooks/useAdvanceStage";
import { useActivities } from "../hooks/useActivities";
import { usePins } from "../hooks/usePins";
import { STAGE_LABELS, PIPELINE_LABELS } from "../lib/pipelines";
import type { Pipeline } from "../lib/pipelines";
import StageTracker from "../components/gates/StageTracker";
import GateChecklist from "../components/gates/GateChecklist";
import QuickLogFAB from "../components/quick-log/QuickLogFAB";

// ── reusable field components ──────────────────────────────────────

function Toggle({
  label,
  value,
  onToggle,
  isSaving,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  isSaving: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        disabled={isSaving}
        onClick={() => onToggle(!value)}
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent
                    transition-colors duration-200 focus:outline-none
                    ${value ? "bg-green-500" : "bg-gray-300"}
                    ${isSaving ? "opacity-50" : ""}`}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow transform
                      transition-transform duration-200 ${value ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

function TextInput({
  label,
  value,
  placeholder,
  onSave,
  isSaving,
  type = "text",
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
  isSaving: boolean;
  type?: string;
}) {
  const [local, setLocal] = useState(value);
  const dirty = local !== value;

  return (
    <div className="py-2.5">
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type={type}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { if (dirty) onSave(local); }}
          placeholder={placeholder}
          disabled={isSaving}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                     disabled:opacity-50"
        />
        {dirty && (
          <button
            type="button"
            onClick={() => onSave(local)}
            disabled={isSaving}
            className="rounded-lg bg-gray-900 text-white px-3 py-2.5 text-xs font-medium
                       active:bg-gray-700 disabled:opacity-50 shrink-0"
          >
            {isSaving ? "..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  placeholder,
  onSave,
  isSaving,
}: {
  label: string;
  value: number | null;
  placeholder?: string;
  onSave: (v: number | null) => void;
  isSaving: boolean;
}) {
  const [local, setLocal] = useState(value != null ? String(value) : "");
  const numVal = local === "" ? null : parseFloat(local);
  const dirty = numVal !== value;

  return (
    <div className="py-2.5">
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { if (dirty) onSave(numVal); }}
          placeholder={placeholder}
          disabled={isSaving}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                     disabled:opacity-50"
        />
        {dirty && (
          <button
            type="button"
            onClick={() => onSave(numVal)}
            disabled={isSaving}
            className="rounded-lg bg-gray-900 text-white px-3 py-2.5 text-xs font-medium
                       active:bg-gray-700 disabled:opacity-50 shrink-0"
          >
            {isSaving ? "..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

function DateInput({
  label,
  value,
  onSave,
  isSaving,
}: {
  label: string;
  value: string | null;
  onSave: (v: string | null) => void;
  isSaving: boolean;
}) {
  const dateStr = value ? new Date(value).toISOString().slice(0, 16) : "";
  const [local, setLocal] = useState(dateStr);
  const dirty = local !== dateStr;

  return (
    <div className="py-2.5">
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="datetime-local"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            if (dirty) onSave(local || null);
          }}
          disabled={isSaving}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                     disabled:opacity-50"
        />
        {dirty && (
          <button
            type="button"
            onClick={() => onSave(local || null)}
            disabled={isSaving}
            className="rounded-lg bg-gray-900 text-white px-3 py-2.5 text-xs font-medium
                       active:bg-gray-700 disabled:opacity-50 shrink-0"
          >
            {isSaving ? "..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────

export default function OppDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: opp, loading, error, refetch } = useOpportunity(id);
  const { updateBidsField, updateOppField, saving, error: saveError } =
    useUpdateBids(id ?? "", refetch);
  const { advance, loading: advancing, error: advanceError } =
    useAdvanceStage(id ?? "", refetch);
  const { activities, refetch: refetchActivities } = useActivities(id);
  const { isPinned, pin, unpin } = usePins();

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
  const isSaving = (field: string) => saving === field;

  return (
    <div className="space-y-4 pb-8">
      {/* Back + header */}
      <button onClick={() => navigate("/")} className="text-sm text-blue-600">
        &larr; Back
      </button>

      <div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900">{opp.name}</h1>
          <button
            onClick={() => isPinned(opp.id) ? unpin(opp.id) : pin(opp.id)}
            className={`shrink-0 text-lg mt-0.5 ${isPinned(opp.id) ? "text-yellow-500" : "text-gray-300"}`}
            aria-label={isPinned(opp.id) ? "Unpin" : "Pin"}
          >
            {isPinned(opp.id) ? "\u2605" : "\u2606"}
          </button>
        </div>
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
      <GateChecklist
        opp={opp}
        onAdvance={advance}
        advancing={advancing}
        advanceError={advanceError}
      />

      {/* Save error */}
      {saveError && (
        <p className="text-red-500 text-sm text-center">{saveError}</p>
      )}

      {/* Editable bid fields */}
      <div className="rounded-xl bg-white border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          Bid Details
        </h3>
        <div className="divide-y divide-gray-100">
          <NumberInput
            label="Amount ($)"
            value={opp.amount}
            placeholder="Bid amount"
            onSave={(v) => updateOppField("amount", v)}
            isSaving={isSaving("amount")}
          />

          <TextInput
            label="Plans Link"
            value={bids.plans_link ?? ""}
            placeholder="https://planroom.com/..."
            onSave={(v) => updateBidsField("plans_link", v || null)}
            isSaving={isSaving("plans_link")}
            type="url"
          />

          <Toggle
            label="Go / No-Go"
            value={bids.go_no_go}
            onToggle={(v) => updateBidsField("go_no_go", v)}
            isSaving={isSaving("go_no_go")}
          />

          <Toggle
            label="Addenda Acknowledged"
            value={bids.addenda_acknowledged}
            onToggle={(v) => updateBidsField("addenda_acknowledged", v)}
            isSaving={isSaving("addenda_acknowledged")}
          />

          {/* TODO: actual file upload — for now, paste URL */}
          <TextInput
            label="Estimate File URL"
            value={bids.estimate_file_url ?? ""}
            placeholder="https://storage/estimate.pdf"
            onSave={(v) => updateBidsField("estimate_file_url", v || null)}
            isSaving={isSaving("estimate_file_url")}
            type="url"
          />

          <DateInput
            label="Bid Due Date"
            value={bids.bid_due_at}
            onSave={(v) => updateBidsField("bid_due_at", v)}
            isSaving={isSaving("bid_due_at")}
          />
        </div>
      </div>

      {/* Walk section */}
      <div className="rounded-xl bg-white border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          Pre-Bid Walk
        </h3>
        <div className="divide-y divide-gray-100">
          <Toggle
            label="Walk Mandatory"
            value={bids.prebid_walk_mandatory}
            onToggle={(v) => updateBidsField("prebid_walk_mandatory", v)}
            isSaving={isSaving("prebid_walk_mandatory")}
          />

          {bids.prebid_walk_mandatory && (
            <>
              <DateInput
                label="Walk Date"
                value={bids.prebid_walk_at}
                onSave={(v) => updateBidsField("prebid_walk_at", v)}
                isSaving={isSaving("prebid_walk_at")}
              />
              <Toggle
                label="Walk Completed"
                value={bids.prebid_walk_completed}
                onToggle={(v) => updateBidsField("prebid_walk_completed", v)}
                isSaving={isSaving("prebid_walk_completed")}
              />
            </>
          )}
        </div>
      </div>

      {/* Bond section */}
      <div className="rounded-xl bg-white border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          Bond
        </h3>
        <div className="divide-y divide-gray-100">
          <Toggle
            label="Bond Required"
            value={bids.bond_required}
            onToggle={(v) => updateBidsField("bond_required", v)}
            isSaving={isSaving("bond_required")}
          />

          {bids.bond_required && (
            <>
              <NumberInput
                label="Bond Amount ($)"
                value={bids.bond_amount}
                placeholder="Bond amount"
                onSave={(v) => updateBidsField("bond_amount", v)}
                isSaving={isSaving("bond_amount")}
              />
              <Toggle
                label="Bond Arranged"
                value={bids.bond_arranged}
                onToggle={(v) => updateBidsField("bond_arranged", v)}
                isSaving={isSaving("bond_arranged")}
              />
            </>
          )}
        </div>
      </div>

      {/* Activity timeline */}
      <div className="rounded-xl bg-white border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Activity Log
        </h3>
        {activities.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No activities yet — tap + to log one.
          </p>
        ) : (
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <div className="shrink-0 mt-0.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    a.pending
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {a.type}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  {a.note && (
                    <p className="text-gray-700">{a.note}</p>
                  )}
                  {a.next_action && (
                    <p className="text-gray-500 text-xs mt-0.5">
                      Next: {a.next_action}
                      {a.next_action_at && ` (${new Date(a.next_action_at).toLocaleDateString()})`}
                    </p>
                  )}
                  <p className="text-gray-400 text-xs mt-0.5">
                    {new Date(a.logged_at).toLocaleString()}
                    {a.pending && " · pending sync"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick-log FAB */}
      <QuickLogFAB opportunityId={opp.id} onLogged={refetchActivities} />
    </div>
  );
}
