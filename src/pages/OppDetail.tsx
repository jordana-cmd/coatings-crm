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

import type { Database } from "../lib/database.types";
import { useBidQuotes } from "../hooks/useBidQuotes";
import { useOppDocuments, type OppDocument } from "../hooks/useOppDocuments";
import { supabase } from "../lib/supabase";
import { Trash2 } from "lucide-react";

type OppUpdate = Database["public"]["Tables"]["opportunities"]["Update"];

const PRIORITY_COLORS: Record<string, string> = {
  A: "bg-brand-light text-brand", B: "bg-pending-light text-pending", C: "bg-gray-100 text-label",
};

function ageInStage(stageEnteredAt: string | null): { days: number; label: string; stale: boolean } {
  if (!stageEnteredAt) return { days: 0, label: "—", stale: false };
  const days = Math.floor((Date.now() - new Date(stageEnteredAt).getTime()) / 86400000);
  return { days, label: days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`, stale: days > 14 };
}

function DealManagement({ opp, updateOppField, isSaving }: {
  opp: Database["public"]["Tables"]["opportunities"]["Row"];
  updateOppField: <K extends keyof OppUpdate>(field: K, value: OppUpdate[K]) => Promise<void>;
  isSaving: (f: string) => boolean;
}) {
  const age = ageInStage(opp.stage_entered_at);
  const weighted = opp.amount != null && opp.win_probability != null
    ? opp.amount * opp.win_probability / 100
    : null;

  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    expected_close_date: opp.expected_close_date ?? "",
    win_probability: opp.win_probability != null ? String(opp.win_probability) : "",
    next_step: opp.next_step ?? "",
    next_step_date: opp.next_step_date ?? "",
    priority: opp.priority ?? "",
    competitor: opp.competitor ?? "",
  });

  const save = async () => {
    await updateOppField("expected_close_date", f.expected_close_date || null);
    await updateOppField("win_probability", f.win_probability ? parseFloat(f.win_probability) : null);
    await updateOppField("next_step", f.next_step || null);
    await updateOppField("next_step_date", f.next_step_date || null);
    await updateOppField("priority", f.priority || null);
    await updateOppField("competitor", f.competitor || null);
    setEditing(false);
  };

  const cls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40";

  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-label uppercase tracking-wider">Deal Management</h3>
        <button onClick={() => setEditing(!editing)}
          className="text-xs text-brand font-medium">{editing ? "Cancel" : "Edit"}</button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Expected Close</label>
              <input type="date" value={f.expected_close_date} onChange={(e) => setF(p => ({...p, expected_close_date: e.target.value}))} className={cls} /></div>
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Win Probability (%)</label>
              <input type="number" min={0} max={100} value={f.win_probability} onChange={(e) => setF(p => ({...p, win_probability: e.target.value}))} className={cls} /></div>
          </div>
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Next Step</label>
            <input value={f.next_step} onChange={(e) => setF(p => ({...p, next_step: e.target.value}))} className={cls} placeholder="Follow up with estimator..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Next Step Date</label>
              <input type="date" value={f.next_step_date} onChange={(e) => setF(p => ({...p, next_step_date: e.target.value}))} className={cls} /></div>
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Priority</label>
              <select value={f.priority} onChange={(e) => setF(p => ({...p, priority: e.target.value}))} className={cls}>
                <option value="">None</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
              </select></div>
          </div>
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Competitor</label>
            <input value={f.competitor} onChange={(e) => setF(p => ({...p, competitor: e.target.value}))} className={cls} placeholder="Name of competing bidder..." /></div>
          <button onClick={save} disabled={isSaving("priority")}
            className="w-full rounded-lg bg-brand text-white py-2.5 text-sm font-medium active:bg-brand-hover disabled:opacity-50">
            Save</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-label uppercase tracking-wider">Win Probability</p>
            <p className="text-sm font-semibold text-heading mt-0.5">{opp.win_probability != null ? `${opp.win_probability}%` : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-label uppercase tracking-wider">Weighted Amount</p>
            <p className="text-sm font-semibold text-heading mt-0.5">{weighted != null ? `$${weighted.toLocaleString(undefined, {maximumFractionDigits: 0})}` : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-label uppercase tracking-wider">Age in Stage</p>
            <p className={`text-sm font-semibold mt-0.5 ${age.stale ? "text-pending" : "text-heading"}`}>{age.label}</p>
          </div>
          <div>
            <p className="text-[10px] text-label uppercase tracking-wider">Expected Close</p>
            <p className="text-sm text-heading mt-0.5">{opp.expected_close_date ? new Date(opp.expected_close_date).toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-label uppercase tracking-wider">Priority</p>
            {opp.priority ? (
              <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_COLORS[opp.priority] ?? "bg-gray-100 text-label"}`}>
                Tier {opp.priority}
              </span>
            ) : <p className="text-sm text-subtle mt-0.5">—</p>}
          </div>
          <div>
            <p className="text-[10px] text-label uppercase tracking-wider">Competitor</p>
            <p className="text-sm text-heading mt-0.5">{opp.competitor ?? "—"}</p>
          </div>
          {opp.next_step && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-[10px] text-label uppercase tracking-wider">Next Step</p>
              <p className="text-sm text-heading mt-0.5">{opp.next_step}
                {opp.next_step_date && <span className="text-subtle ml-1">({new Date(opp.next_step_date).toLocaleDateString()})</span>}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── GCs Quoted card (PUBLIC_BID only) ──────────────────────────────

function GCsQuotedCard({ bidQuotes }: {
  bidQuotes: ReturnType<typeof useBidQuotes>;
}) {
  const { quotes, addQuote, updateQuote, removeQuote } = bidQuotes;
  const [showAdd, setShowAdd] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selGc, setSelGc] = useState("");
  const [amt, setAmt] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [adding, setAdding] = useState(false);

  const carriedCount = quotes.filter((q) => q.carried_us).length;
  const winner = quotes.find((q) => q.gc_won_award);

  const loadGCs = async () => {
    if (!supabase) return;
    const { data } = await supabase.from("companies").select("id, name").eq("type", "GC").order("name");
    setCompanies(data ?? []);
  };

  const handleAdd = async () => {
    if (!selGc) return;
    setAdding(true);
    await addQuote(selGc, amt ? parseFloat(amt) : undefined, addNotes.trim() || undefined);
    setSelGc(""); setAmt(""); setAddNotes(""); setShowAdd(false); setAdding(false);
  };

  const cls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40";

  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-semibold text-label uppercase tracking-wider">GCs Quoted</h3>
          {quotes.length > 0 && (
            <p className="text-[10px] text-subtle mt-0.5">
              Quoted {quotes.length} GC{quotes.length !== 1 ? "s" : ""} · {carriedCount} carried our number
            </p>
          )}
        </div>
        <button onClick={() => { setShowAdd(true); loadGCs(); }}
          className="text-xs text-brand font-medium">+ Add GC</button>
      </div>

      {winner && (
        <div className="rounded-lg bg-gate-met-light border border-gate-met/20 px-3 py-2 mb-3 flex items-center gap-2">
          <span className="text-[10px] font-bold text-gate-met bg-white rounded px-1.5 py-0.5">PRIME</span>
          <span className="text-sm font-medium text-gate-met">Won by: {winner.gc_name}</span>
        </div>
      )}

      {quotes.length === 0 ? (
        <p className="text-sm text-subtle text-center py-6">No GCs quoted yet — add the GCs you sent your number to.</p>
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => (
            <div key={q.id} className={`rounded-lg border p-3 ${q.gc_won_award ? "border-gate-met/30 bg-gate-met-light/30" : "border-card-border"}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-heading">{q.gc_name}</span>
                <button onClick={() => removeQuote(q.id)} className="text-[10px] text-subtle hover:text-dq">Remove</button>
              </div>
              <div className="flex items-center gap-4 text-xs">
                {q.quoted_amount != null && (
                  <span className="text-heading font-medium">${q.quoted_amount.toLocaleString()}</span>
                )}
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={q.carried_us}
                    onChange={(e) => updateQuote(q.id, { carried_us: e.target.checked })}
                    className="rounded border-gray-300 text-brand focus:ring-brand h-3.5 w-3.5" />
                  <span className="text-label">Carried us</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={q.gc_won_award}
                    onChange={(e) => updateQuote(q.id, { gc_won_award: e.target.checked })}
                    className="rounded border-gray-300 text-brand focus:ring-brand h-3.5 w-3.5" />
                  <span className="text-label">GC won award</span>
                </label>
              </div>
              {q.notes && <p className="text-xs text-subtle mt-1">{q.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Add GC form */}
      {showAdd && (
        <div className="mt-3 rounded-lg border border-card-border p-3 bg-gray-50/50 space-y-2">
          <select value={selGc} onChange={(e) => setSelGc(e.target.value)} className={cls}>
            <option value="">Select a GC...</option>
            {companies.filter((c) => !quotes.some((q) => q.gc_company_id === c.id)).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input type="number" step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)}
            placeholder="Quoted amount (optional)" className={cls} />
          <input value={addNotes} onChange={(e) => setAddNotes(e.target.value)}
            placeholder="Notes (optional)" className={cls} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-label">Cancel</button>
            <button onClick={handleAdd} disabled={!selGc || adding}
              className="px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg active:bg-brand-hover disabled:opacity-50">
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── reusable field components ──────────────────────────────────────

function Toggle({ label, value, onToggle, isSaving }: {
  label: string; value: boolean; onToggle: (v: boolean) => void; isSaving: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-label">{label}</span>
      <button type="button" disabled={isSaving} onClick={() => onToggle(!value)}
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent
                    transition-colors duration-200 focus:outline-none
                    ${value ? "bg-gate-met" : "bg-gray-300"} ${isSaving ? "opacity-50" : ""}`}>
        <span className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow transform
                          transition-transform duration-200 ${value ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function TextInput({ label, value, placeholder, onSave, isSaving, type = "text" }: {
  label: string; value: string; placeholder?: string; onSave: (v: string) => void; isSaving: boolean; type?: string;
}) {
  const [local, setLocal] = useState(value);
  const dirty = local !== value;
  return (
    <div className="py-2.5">
      <label className="block text-xs text-label mb-1">{label}</label>
      <div className="flex gap-2">
        <input type={type} value={local} onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { if (dirty) onSave(local); }} placeholder={placeholder} disabled={isSaving}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading
                     focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:opacity-50" />
        {dirty && (
          <button type="button" onClick={() => onSave(local)} disabled={isSaving}
            className="rounded-lg bg-brand text-white px-3 py-2.5 text-xs font-medium
                       active:bg-brand-hover disabled:opacity-50 shrink-0">
            {isSaving ? "..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

function NumberInput({ label, value, placeholder, onSave, isSaving }: {
  label: string; value: number | null; placeholder?: string; onSave: (v: number | null) => void; isSaving: boolean;
}) {
  const [local, setLocal] = useState(value != null ? String(value) : "");
  const numVal = local === "" ? null : parseFloat(local);
  const dirty = numVal !== value;
  return (
    <div className="py-2.5">
      <label className="block text-xs text-label mb-1">{label}</label>
      <div className="flex gap-2">
        <input type="number" step="0.01" value={local} onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { if (dirty) onSave(numVal); }} placeholder={placeholder} disabled={isSaving}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading
                     focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:opacity-50" />
        {dirty && (
          <button type="button" onClick={() => onSave(numVal)} disabled={isSaving}
            className="rounded-lg bg-brand text-white px-3 py-2.5 text-xs font-medium
                       active:bg-brand-hover disabled:opacity-50 shrink-0">
            {isSaving ? "..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

function GrossProfitInput({ amount, grossProfitPct, onSave, isSaving }: {
  amount: number | null; grossProfitPct: number | null; onSave: (v: number | null) => void; isSaving: boolean;
}) {
  const [local, setLocal] = useState(grossProfitPct != null ? String(grossProfitPct) : "");
  const numVal = local === "" ? null : parseFloat(local);
  const dirty = numVal !== grossProfitPct;
  const gpDollars = amount != null && numVal != null ? amount * numVal / 100 : null;

  return (
    <div className="py-2.5">
      <label className="block text-xs text-label mb-1">Gross Profit %</label>
      <div className="flex gap-2">
        <input type="number" step="0.1" min="0" max="100" value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { if (dirty) onSave(numVal); }} placeholder="e.g. 30"
          disabled={isSaving}
          className="w-24 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading
                     focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:opacity-50" />
        {gpDollars != null && (
          <span className="flex items-center text-xs text-label">
            → ${gpDollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            {amount != null && <span className="text-subtle ml-1">on ${amount.toLocaleString()}</span>}
          </span>
        )}
        {dirty && (
          <button type="button" onClick={() => onSave(numVal)} disabled={isSaving}
            className="rounded-lg bg-brand text-white px-3 py-2.5 text-xs font-medium
                       active:bg-brand-hover disabled:opacity-50 shrink-0">
            {isSaving ? "..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

function DateInput({ label, value, onSave, isSaving }: {
  label: string; value: string | null; onSave: (v: string | null) => void; isSaving: boolean;
}) {
  const dateStr = value ? new Date(value).toISOString().slice(0, 16) : "";
  const [local, setLocal] = useState(dateStr);
  const dirty = local !== dateStr;
  return (
    <div className="py-2.5">
      <label className="block text-xs text-label mb-1">{label}</label>
      <div className="flex gap-2">
        <input type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { if (dirty) onSave(local || null); }} disabled={isSaving}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading
                     focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:opacity-50" />
        {dirty && (
          <button type="button" onClick={() => onSave(local || null)} disabled={isSaving}
            className="rounded-lg bg-brand text-white px-3 py-2.5 text-xs font-medium
                       active:bg-brand-hover disabled:opacity-50 shrink-0">
            {isSaving ? "..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────

// ── Documents Card ──

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsCard({ docs: hook }: { oppId: string; docs: ReturnType<typeof useOppDocuments> }) {
  const { docs, loading, uploading, upload, getDownloadUrl, deleteDoc } = hook;
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OppDocument | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const result = await upload(file);
    if (result.error) setError(result.error);
    e.target.value = ""; // reset input
  };

  const handleDownload = async (doc: OppDocument) => {
    const url = await getDownloadUrl(doc.storage_path);
    if (url) window.open(url, "_blank");
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const result = await deleteDoc(confirmDelete);
    if (result.error) setError(result.error);
    setConfirmDelete(null);
  };

  return (
    <div className="bg-card rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-label uppercase tracking-wide">
          Documents {docs.length > 0 && <span className="text-heading">({docs.length})</span>}
        </h3>
        <label className={`rounded-lg bg-brand text-white px-3 py-1.5 text-xs font-medium cursor-pointer active:bg-brand-hover ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? "Uploading..." : "Upload"}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {error && (
        <p className="text-xs text-brand bg-brand-light rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-subtle text-center py-6">No documents attached — upload bid docs, proposals, or estimates.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-card-border px-3 py-2.5">
              <button onClick={() => handleDownload(doc)} className="min-w-0 flex-1 text-left group">
                <p className="text-sm font-medium text-heading truncate group-active:text-brand">{doc.file_name}</p>
                <p className="text-[10px] text-subtle">
                  {formatFileSize(doc.file_size)} · {new Date(doc.uploaded_at).toLocaleDateString()}
                </p>
              </button>
              <button onClick={() => setConfirmDelete(doc)}
                className="shrink-0 text-[10px] text-label hover:text-brand px-2 py-1 rounded active:bg-gray-50">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-5 max-w-sm w-full" style={{ boxShadow: "var(--shadow-card)" }}>
            <p className="text-sm font-semibold text-heading mb-2">Delete document?</p>
            <p className="text-xs text-label mb-4 truncate">{confirmDelete.file_name}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-label hover:text-heading">Cancel</button>
              <button onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg active:bg-brand-hover">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isPublicBid = opp?.pipeline === "PUBLIC_BID";
  const bidQuotes = useBidQuotes(isPublicBid ? id : undefined);
  const oppDocs = useOppDocuments(id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-shell-border border-t-brand" />
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="text-center py-12">
        <div className="bg-card rounded-xl shadow-sm p-8">
          <p className="text-brand text-sm mb-4">{error ?? "Not found"}</p>
          <button onClick={() => navigate("/")} className="text-sm text-brand font-medium">
            &larr; Back to list
          </button>
        </div>
      </div>
    );
  }

  const bids = opp.bids;
  const isSaving = (field: string) => saving === field;

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <button onClick={() => navigate("/")} className="text-sm text-brand font-medium">
        &larr; Back
      </button>

      {/* Header card */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-bold text-heading">{opp.name}</h1>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => isPinned(opp.id) ? unpin(opp.id) : pin(opp.id)}
              className={`text-lg ${isPinned(opp.id) ? "text-pending" : "text-subtle"}`}
              aria-label={isPinned(opp.id) ? "Unpin" : "Pin"}>
              {isPinned(opp.id) ? "\u2605" : "\u2606"}
            </button>
            <button onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 text-subtle hover:text-brand rounded-lg hover:bg-brand-light transition-colors"
              title="Delete deal">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <p className="text-sm text-label mt-0.5">
          {opp.company_name ?? "—"} &middot;{" "}
          {PIPELINE_LABELS[opp.pipeline as Pipeline]} &middot;{" "}
          {STAGE_LABELS[opp.stage] ?? opp.stage}
        </p>
        <p className="text-xs text-subtle mt-0.5">{opp.job_site_address}</p>

        <div className="mt-3">
          <StageTracker opp={opp} />
        </div>
      </div>

      {/* Gate checklist */}
      <GateChecklist opp={opp} onAdvance={advance} advancing={advancing} advanceError={advanceError} />

      {saveError && (
        <div className="bg-dq-bg border border-dq-border rounded-xl p-3 text-sm text-dq text-center">{saveError}</div>
      )}

      {/* Deal Management */}
      <DealManagement opp={opp} updateOppField={updateOppField} isSaving={isSaving} />

      {/* Bid Details */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <h3 className="text-xs font-semibold text-label uppercase tracking-wide mb-2">Bid Details</h3>
        <div className="divide-y divide-card-border">
          <NumberInput label="Amount ($)" value={opp.amount} placeholder="Bid amount"
            onSave={(v) => updateOppField("amount", v)} isSaving={isSaving("amount")} />
          <GrossProfitInput amount={opp.amount} grossProfitPct={opp.gross_profit_pct}
            onSave={(v) => updateOppField("gross_profit_pct", v)} isSaving={isSaving("gross_profit_pct")} />
          <TextInput label="Plans Link" value={bids.plans_link ?? ""} placeholder="https://planroom.com/..."
            onSave={(v) => updateBidsField("plans_link", v || null)} isSaving={isSaving("plans_link")} type="url" />
          <Toggle label="Go / No-Go" value={bids.go_no_go}
            onToggle={(v) => updateBidsField("go_no_go", v)} isSaving={isSaving("go_no_go")} />
          <Toggle label="Addenda Acknowledged" value={bids.addenda_acknowledged}
            onToggle={(v) => updateBidsField("addenda_acknowledged", v)} isSaving={isSaving("addenda_acknowledged")} />
          <TextInput label="Estimate File URL" value={bids.estimate_file_url ?? ""}
            placeholder="https://storage/estimate.pdf"
            onSave={(v) => updateBidsField("estimate_file_url", v || null)} isSaving={isSaving("estimate_file_url")} type="url" />
          <DateInput label="Bid Due Date" value={bids.bid_due_at}
            onSave={(v) => updateBidsField("bid_due_at", v)} isSaving={isSaving("bid_due_at")} />
        </div>
      </div>

      {/* Walk */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <h3 className="text-xs font-semibold text-label uppercase tracking-wide mb-2">Pre-Bid Walk</h3>
        <div className="divide-y divide-card-border">
          <Toggle label="Walk Mandatory" value={bids.prebid_walk_mandatory}
            onToggle={(v) => updateBidsField("prebid_walk_mandatory", v)} isSaving={isSaving("prebid_walk_mandatory")} />
          {bids.prebid_walk_mandatory && (
            <>
              <DateInput label="Walk Date" value={bids.prebid_walk_at}
                onSave={(v) => updateBidsField("prebid_walk_at", v)} isSaving={isSaving("prebid_walk_at")} />
              <Toggle label="Walk Completed" value={bids.prebid_walk_completed}
                onToggle={(v) => updateBidsField("prebid_walk_completed", v)} isSaving={isSaving("prebid_walk_completed")} />
            </>
          )}
        </div>
      </div>

      {/* Bond */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <h3 className="text-xs font-semibold text-label uppercase tracking-wide mb-2">Bond</h3>
        <div className="divide-y divide-card-border">
          <Toggle label="Bond Required" value={bids.bond_required}
            onToggle={(v) => updateBidsField("bond_required", v)} isSaving={isSaving("bond_required")} />
          {bids.bond_required && (
            <>
              <NumberInput label="Bond Amount ($)" value={bids.bond_amount} placeholder="Bond amount"
                onSave={(v) => updateBidsField("bond_amount", v)} isSaving={isSaving("bond_amount")} />
              <Toggle label="Bond Arranged" value={bids.bond_arranged}
                onToggle={(v) => updateBidsField("bond_arranged", v)} isSaving={isSaving("bond_arranged")} />
            </>
          )}
        </div>
      </div>

      {/* GCs Quoted — PUBLIC_BID only */}
      {isPublicBid && <GCsQuotedCard bidQuotes={bidQuotes} />}

      {/* Documents */}
      <DocumentsCard oppId={opp.id} docs={oppDocs} />

      {/* Activity timeline */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <h3 className="text-xs font-semibold text-label uppercase tracking-wide mb-3">Activity Log</h3>
        {activities.length === 0 ? (
          <p className="text-sm text-subtle text-center py-4">No activities yet — tap + to log one.</p>
        ) : (
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <div className="shrink-0 mt-0.5">
                  <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${
                    a.pending ? "bg-pending-light text-pending" : "bg-gray-100 text-label"
                  }`}>{a.type}</span>
                </div>
                <div className="min-w-0 flex-1">
                  {a.note && <p className="text-heading text-sm">{a.note}</p>}
                  {a.next_action && (
                    <p className="text-label text-xs mt-0.5">
                      Next: {a.next_action}
                      {a.next_action_at && ` (${new Date(a.next_action_at).toLocaleDateString()})`}
                    </p>
                  )}
                  <p className="text-subtle text-xs mt-0.5">
                    {new Date(a.logged_at).toLocaleString()}
                    {a.pending && " · pending sync"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <QuickLogFAB opportunityId={opp.id} companyId={opp.company_id} onLogged={refetchActivities} />

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm" style={{ boxShadow: "var(--shadow-card)" }}>
            <h2 className="text-lg font-semibold text-heading mb-2">Delete this deal?</h2>
            <p className="text-sm text-label mb-4">
              This permanently removes the deal and all its activity, bids, and history. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-label hover:text-heading">Cancel</button>
              <button onClick={async () => {
                setDeleting(true);
                if (supabase) {
                  await supabase.rpc("delete_opportunity", { p_opp_id: opp.id });
                }
                navigate("/opportunities");
              }} disabled={deleting}
                className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg active:bg-brand-hover disabled:opacity-50">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
