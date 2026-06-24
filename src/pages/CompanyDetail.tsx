import { useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCompany } from "../hooks/useCompany";
import { STAGE_LABELS, PIPELINE_LABELS, type Pipeline } from "../lib/pipelines";
import type { Database } from "../lib/database.types";
import { Phone, Mail, ExternalLink, UserCheck } from "lucide-react";

type ContactRole = Database["public"]["Enums"]["contact_role"];
type OppRow = Database["public"]["Tables"]["opportunities"]["Row"];

const ROLE_LABELS: Record<ContactRole, string> = {
  PM: "PM", ESTIMATOR: "Estimator", SUPER: "Super", FM: "FM",
  PURCHASING: "Purchasing", SPEC_WRITER: "Spec Writer",
};
const ROLE_OPTIONS: ContactRole[] = ["PM", "ESTIMATOR", "SUPER", "FM", "PURCHASING", "SPEC_WRITER"];

const TYPE_LABELS: Record<string, string> = {
  GC: "General Contractor", AWARDING_AUTHORITY: "Awarding Authority",
  PLANT_OWNER: "Plant Owner", ARCHITECT: "Architect",
};

function JobGroup({ title, opps, navigate }: { title: string; opps: OppRow[]; navigate: (p: string) => void }) {
  if (opps.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className="text-[10px] font-semibold text-label uppercase tracking-wider mb-1">
        {title} ({opps.length})
      </h4>
      <div className="space-y-1">
        {opps.map((o) => (
          <button key={o.id} onClick={() => navigate(`/opp/${o.id}`)}
            className="w-full text-left rounded-lg border border-card-border p-2.5 active:bg-gray-50 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-heading truncate">{o.name}</p>
              <p className="text-[10px] text-label">
                {PIPELINE_LABELS[o.pipeline as Pipeline]} · {STAGE_LABELS[o.stage] ?? o.stage}
              </p>
            </div>
            {o.amount != null && (
              <span className="text-xs font-medium text-heading shrink-0">${o.amount.toLocaleString()}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error, updateNotes, addContact } = useCompany(id);
  const [notesLocal, setNotesLocal] = useState<string | null>(null);
  const [notesSaving, setNotesSaving] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-shell-border border-t-brand" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <div className="bg-card rounded-xl shadow-sm p-8">
          <p className="text-brand text-sm mb-4">{error ?? "Not found"}</p>
          <button onClick={() => navigate("/companies")} className="text-sm text-brand font-medium">&larr; Back</button>
        </div>
      </div>
    );
  }

  const { company: co, contacts, opportunities } = data;
  const notes = notesLocal ?? co.notes ?? "";

  const ongoing = opportunities.filter((o) => o.status === "OPEN");
  const wonInProgress = opportunities.filter((o) => o.status === "WON" && !o.completed_at);
  const completed = opportunities.filter((o) => o.status === "WON" && !!o.completed_at);
  const lost = opportunities.filter((o) => o.status === "LOST");

  const handleNotesSave = async () => {
    setNotesSaving(true);
    await updateNotes(notes);
    setNotesLocal(null);
    setNotesSaving(false);
  };

  return (
    <div className="space-y-4 pb-16 md:pb-6">
      <button onClick={() => navigate("/companies")} className="text-sm text-brand font-medium">&larr; Companies</button>

      {/* Header */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <h1 className="text-lg font-bold text-heading">{co.name}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-heading">
            {TYPE_LABELS[co.type] ?? co.type}
          </span>
          <span className="text-xs text-label">
            {co.city && co.state ? `${co.city}, ${co.state}` : co.state ?? co.region}
          </span>
        </div>
        <p className="text-sm text-label mt-2">{co.address}</p>
        {co.website && (
          <a href={co.website.startsWith("http") ? co.website : `https://${co.website}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-brand mt-1">
            <ExternalLink size={14} /> {co.website}
          </a>
        )}
      </div>

      {/* Notes */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <h3 className="text-xs font-semibold text-label uppercase tracking-wide mb-2">Notes</h3>
        <textarea value={notes}
          onChange={(e) => setNotesLocal(e.target.value)}
          onBlur={() => { if (notesLocal !== null && notesLocal !== (co.notes ?? "")) handleNotesSave(); }}
          placeholder="Add notes about this company..."
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading
                     focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
        {notesSaving && <p className="text-[10px] text-label mt-1">Saving...</p>}
      </div>

      {/* Contacts */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-label uppercase tracking-wide">
            Contacts ({contacts.length})
          </h3>
          <button onClick={() => setShowAddContact(true)} className="text-xs text-brand font-medium">+ Add</button>
        </div>
        {contacts.length === 0 ? (
          <p className="text-sm text-subtle text-center py-4">No contacts yet.</p>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="rounded-lg border border-card-border p-3">
                <div className="flex items-center justify-between">
                  <button onClick={() => navigate(`/contacts/${c.id}`)}
                    className="font-medium text-sm text-heading active:text-brand truncate text-left">
                    {c.name}
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.is_decision_maker && (
                      <span className="flex items-center gap-0.5 text-[10px] text-gate-met font-medium">
                        <UserCheck size={12} /> DM
                      </span>
                    )}
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-heading">{ROLE_LABELS[c.role]}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-brand">
                    <Phone size={12} /> {c.phone}
                  </a>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-brand">
                      <Mail size={12} /> Email
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Jobs */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <h3 className="text-xs font-semibold text-label uppercase tracking-wide">
          Jobs ({opportunities.length})
        </h3>
        {opportunities.length === 0 ? (
          <p className="text-sm text-subtle text-center py-4">No jobs linked to this company.</p>
        ) : (
          <>
            <JobGroup title="Ongoing" opps={ongoing} navigate={navigate} />
            <JobGroup title="Won — In Progress" opps={wonInProgress} navigate={navigate} />
            <JobGroup title="Completed" opps={completed} navigate={navigate} />
            <JobGroup title="Lost" opps={lost} navigate={navigate} />
          </>
        )}
      </div>

      {showAddContact && (
        <AddContactModal onAdd={addContact} onClose={() => setShowAddContact(false)} />
      )}
    </div>
  );
}

function AddContactModal({
  onAdd,
  onClose,
}: {
  onAdd: (input: { name: string; role: ContactRole; phone: string; email?: string; is_decision_maker?: boolean }) => Promise<{ error: string | null }>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<ContactRole>("PM");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dm, setDm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sub, setSub] = useState(false);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setSub(true); setErr(null);
    const res = await onAdd({
      name: name.trim(), role, phone: phone.trim(),
      email: email.trim() || undefined, is_decision_maker: dm,
    });
    if (res.error) { setErr(res.error); setSub(false); }
    else onClose();
  };

  const cls = "w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <form onSubmit={handle} className="w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl p-6 max-h-[90svh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-heading">Add Contact</h2>
          <button type="button" onClick={onClose} className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        <label className="block mb-3">
          <span className="block text-xs text-label mb-1">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={cls} placeholder="John Smith" />
        </label>
        <label className="block mb-3">
          <span className="block text-xs text-label mb-1">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as ContactRole)} className={cls}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </label>
        <label className="block mb-3">
          <span className="block text-xs text-label mb-1">Phone</span>
          <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={cls} placeholder="313-555-0100" />
        </label>
        <label className="block mb-3">
          <span className="block text-xs text-label mb-1">Email (optional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={cls} placeholder="john@example.com" />
        </label>
        <div className="flex items-center justify-between mb-4 py-2">
          <span className="text-sm text-label">Decision Maker?</span>
          <button type="button" onClick={() => setDm(!dm)}
            className={`relative inline-flex h-7 w-12 rounded-full border-2 border-transparent transition-colors
              ${dm ? "bg-gate-met" : "bg-gray-300"}`}>
            <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${dm ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
        {err && <p className="text-brand text-sm mb-3 text-center">{err}</p>}
        <button type="submit" disabled={sub}
          className="w-full rounded-lg bg-brand text-white py-3 text-sm font-medium active:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed">
          {sub ? "Adding..." : "Add Contact"}
        </button>
      </form>
    </div>
  );
}
