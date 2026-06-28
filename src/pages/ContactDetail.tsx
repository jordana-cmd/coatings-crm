import { useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useContact } from "../hooks/useContacts";
import { useContactTimeline } from "../hooks/useContactTimeline";
import { Phone, Mail, UserCheck, ExternalLink, MessageSquare, Clock, Archive, ArchiveRestore, Pencil } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type ContactRole = Database["public"]["Enums"]["contact_role"];

const ROLE_LABELS: Record<string, string> = {
  PM: "PM", ESTIMATOR: "Estimator", SUPER: "Super", FM: "FM",
  PURCHASING: "Purchasing", SPEC_WRITER: "Spec Writer",
};

const ROLE_OPTIONS: { value: ContactRole; label: string }[] = [
  { value: "PM", label: "PM" },
  { value: "ESTIMATOR", label: "Estimator" },
  { value: "SUPER", label: "Super" },
  { value: "FM", label: "FM" },
  { value: "PURCHASING", label: "Purchasing" },
  { value: "SPEC_WRITER", label: "Spec Writer" },
];

const TYPE_ICONS: Record<string, string> = {
  CALL: "\u{1F4DE}", VISIT: "\u{1F3D7}\uFE0F", PREBID_WALK: "\u{1F6B6}",
  EMAIL: "\u2709\uFE0F", NOTE: "\u{1F4DD}",
};

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Edit Contact Modal ──

function EditContactModal({ contact, onSave, onClose }: {
  contact: Database["public"]["Tables"]["contacts"]["Row"];
  onSave: (fields: Record<string, string | boolean | null>) => Promise<void>;
  onClose: () => void;
}) {
  // Split name into first/last for editing
  const parts = contact.name.split(" ");
  const initFirst = parts[0] ?? "";
  const initLast = parts.slice(1).join(" ") ?? "";

  const [f, setF] = useState({
    firstName: initFirst,
    lastName: initLast,
    title: contact.title ?? "",
    role: contact.role as ContactRole,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    city: contact.city ?? "",
    state: contact.state ?? "",
    linkedin_url: contact.linkedin_url ?? "",
    is_decision_maker: contact.is_decision_maker,
    is_favorite: contact.is_favorite,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const cls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40";

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const fullName = `${f.firstName.trim()} ${f.lastName.trim()}`.trim();
    if (!fullName) return;
    setSaving(true);
    await onSave({
      name: fullName,
      title: f.title || null,
      role: f.role,
      phone: f.phone || null,
      email: f.email || null,
      city: f.city || null,
      state: f.state || null,
      linkedin_url: f.linkedin_url || null,
      is_decision_maker: f.is_decision_maker,
      is_favorite: f.is_favorite,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSave} className="w-full max-w-lg bg-card rounded-2xl p-6 max-h-[90svh] overflow-y-auto" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-heading">Edit Contact</h2>
          <button type="button" onClick={onClose} className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">First Name</label>
              <input required value={f.firstName} onChange={(e) => set("firstName", e.target.value)} className={cls} /></div>
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Last Name</label>
              <input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} className={cls} /></div>
          </div>
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Title</label>
            <input value={f.title} onChange={(e) => set("title", e.target.value)} className={cls} placeholder="Project Manager" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Role</label>
              <select value={f.role} onChange={(e) => set("role", e.target.value)} className={cls}>
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select></div>
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Phone</label>
              <input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} className={cls} placeholder="313-555-0100" /></div>
          </div>
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Email</label>
            <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className={cls} placeholder="name@company.com" /></div>
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">LinkedIn</label>
            <input type="url" value={f.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} className={cls} placeholder="https://linkedin.com/in/..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">City</label>
              <input value={f.city} onChange={(e) => set("city", e.target.value)} className={cls} placeholder="Detroit" /></div>
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">State</label>
              <input value={f.state} onChange={(e) => set("state", e.target.value)} className={cls} placeholder="MI" maxLength={2} /></div>
          </div>
          <div className="flex items-center justify-between py-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={f.is_decision_maker}
                onChange={(e) => setF((p) => ({ ...p, is_decision_maker: e.target.checked }))}
                className="rounded border-gray-300 text-brand focus:ring-brand h-4 w-4" />
              <span className="text-sm text-heading">Decision Maker</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={f.is_favorite}
                onChange={(e) => setF((p) => ({ ...p, is_favorite: e.target.checked }))}
                className="rounded border-gray-300 text-brand focus:ring-brand h-4 w-4" />
              <span className="text-sm text-heading">Favorite</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-label hover:text-heading">Cancel</button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg active:bg-brand-hover disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </form>
    </div>
  );
}

// ── Main ──

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error, refetch, updateContact } = useContact(id);
  const { items, loading: tlLoading, lastContacted, addNote } = useContactTimeline(id, data?.company_id);
  const [noteInput, setNoteInput] = useState("");
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const handleArchive = async () => {
    if (!supabase || !id || !data) return;
    const isArchived = !!data.contact.archived_at;
    if (isArchived) {
      await supabase.from("contacts").update({ archived_at: null }).eq("id", id);
    } else {
      await supabase.from("contacts").update({ archived_at: new Date().toISOString() }).eq("id", id);
    }
    await refetch();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="h-8 w-8 animate-spin rounded-full border-4 border-shell-border border-t-brand" /></div>;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <div className="bg-card rounded-2xl p-8" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-brand text-sm mb-4">{error ?? "Not found"}</p>
          <button onClick={() => navigate("/contacts")} className="text-sm text-brand font-medium">&larr; Back</button>
        </div>
      </div>
    );
  }

  const { contact: c, company_name } = data;

  const handlePostNote = async () => {
    if (!noteInput.trim()) return;
    setNoteSaving(true);
    await addNote(noteInput.trim());
    setNoteInput("");
    setNoteExpanded(false);
    setNoteSaving(false);
  };

  return (
    <div className="space-y-4 pb-16 md:pb-6">
      <button onClick={() => navigate("/contacts")} className="text-sm text-brand font-medium">&larr; Contacts</button>

      {/* Header */}
      <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-heading">{c.name}</h1>
            {c.is_decision_maker && (
              <span className="flex items-center gap-0.5 text-xs text-gate-met font-medium">
                <UserCheck size={14} /> Decision Maker
              </span>
            )}
            {c.archived_at && (
              <span className="rounded-full bg-pending-light text-pending px-2 py-0.5 text-[10px] font-medium">Archived</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setShowEdit(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-label border border-card-border rounded-lg hover:bg-gray-50 transition-colors"
              title="Edit contact">
              <Pencil size={12} /> Edit
            </button>
            <button onClick={handleArchive}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-label border border-card-border rounded-lg hover:bg-gray-50 transition-colors"
              title={c.archived_at ? "Unarchive" : "Archive"}>
              {c.archived_at ? <ArchiveRestore size={12} /> : <Archive size={12} />}
              {c.archived_at ? "Unarchive" : "Archive"}
            </button>
          </div>
        </div>
        <p className="text-sm text-heading mb-1">{c.title ?? ROLE_LABELS[c.role] ?? c.role}</p>
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-label">
            {ROLE_LABELS[c.role] ?? c.role}
          </span>
          <button onClick={() => navigate(`/companies/${c.company_id}`)}
            className="text-xs font-medium nav-link">
            {company_name ?? "Company"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3">
          {c.phone && (
            <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-sm text-brand font-medium">
              <Phone size={16} /> {c.phone}
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-sm text-brand font-medium">
              <Mail size={16} /> {c.email}
            </a>
          )}
          {c.linkedin_url && (
            <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 font-medium">
              <ExternalLink size={14} /> LinkedIn
            </a>
          )}
        </div>

        {/* Last contacted */}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-card-border">
          <Clock size={12} className="text-subtle" />
          <span className="text-[10px] text-subtle">
            {lastContacted ? `Last contacted: ${relTime(lastContacted)}` : "Never contacted"}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h3 className="text-xs font-semibold text-label uppercase tracking-wider mb-3">
          Activity & Notes ({items.length})
        </h3>

        {/* Composer */}
        {noteExpanded ? (
          <div className="mb-4">
            <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Write a note..." rows={3} autoFocus
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading
                         focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40 resize-none" />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => { setNoteExpanded(false); setNoteInput(""); }}
                className="px-3 py-1.5 text-xs text-label hover:text-heading">Cancel</button>
              <button onClick={handlePostNote} disabled={noteSaving || !noteInput.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg
                           active:bg-brand-hover disabled:opacity-50">
                {noteSaving ? "Posting..." : "Post Note"}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setNoteExpanded(true)}
            className="w-full text-left rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-subtle
                       hover:border-brand/40 hover:text-label transition-colors mb-4">
            <MessageSquare size={14} className="inline mr-1.5 -mt-0.5" />
            Add a note...
          </button>
        )}

        {/* Timeline list */}
        {tlLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-subtle">No activity yet — log your first call or note</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-2.5">
                {item.kind === "note" ? (
                  <div className="shrink-0 h-7 w-7 rounded-full bg-shell text-white flex items-center justify-center text-[10px] font-semibold mt-0.5">
                    {item.author_initials ?? "?"}
                  </div>
                ) : (
                  <div className="shrink-0 h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-sm mt-0.5">
                    {TYPE_ICONS[item.type ?? ""] ?? "\u{1F4CB}"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.kind === "activity" ? (
                      <span className="text-[10px] font-medium text-label bg-gray-100 rounded px-1.5 py-0.5">
                        {item.type}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-heading">{item.author_name}</span>
                    )}
                    <span className="text-[10px] text-subtle">{relTime(item.timestamp)}</span>
                    {item.direct != null && (
                      <span className={`text-[9px] px-1 py-0.5 rounded ${item.direct ? "bg-gate-met-light text-gate-met" : "bg-gray-100 text-subtle"}`}>
                        {item.direct ? "Direct" : "Job"}
                      </span>
                    )}
                  </div>
                  {item.body && <p className="text-sm text-heading mt-0.5 whitespace-pre-wrap">{item.body}</p>}
                  {item.opp_id && (
                    <button onClick={() => navigate(`/opp/${item.opp_id}`)}
                      className="text-[10px] nav-link mt-0.5 truncate block">
                      {item.opp_name}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {showEdit && (
        <EditContactModal
          contact={c}
          onSave={async (fields) => {
            await updateContact(fields);
            setShowEdit(false);
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
