import { useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCompany } from "../hooks/useCompany";
import { useCompanyKpis } from "../hooks/useCompanyKpis";
import { useCompanyNotes } from "../hooks/useCompanyNotes";
import { STAGE_LABELS, PIPELINE_LABELS, type Pipeline } from "../lib/pipelines";
import type { Database } from "../lib/database.types";
import { Phone, Mail, ExternalLink, Link, UserCheck, Pencil, Users as UsersIcon, MapPin, Globe } from "lucide-react";
import KpiCard from "../components/dashboard/KpiCard";

type ContactRole = Database["public"]["Enums"]["contact_role"];
type CompanyType = Database["public"]["Enums"]["company_type"];
type OppRow = Database["public"]["Tables"]["opportunities"]["Row"];

const ROLE_LABELS: Record<ContactRole, string> = { PM: "PM", ESTIMATOR: "Estimator", SUPER: "Super", FM: "FM", PURCHASING: "Purchasing", SPEC_WRITER: "Spec Writer" };
const ROLE_OPTIONS: ContactRole[] = ["PM", "ESTIMATOR", "SUPER", "FM", "PURCHASING", "SPEC_WRITER"];
const TYPE_LABELS: Record<string, string> = { GC: "General Contractor", AWARDING_AUTHORITY: "Awarding Authority", PLANT_OWNER: "Plant Owner", ARCHITECT: "Architect" };
const TYPE_OPTIONS: { value: CompanyType; label: string }[] = [
  { value: "GC", label: "GC" }, { value: "AWARDING_AUTHORITY", label: "Awarding Authority" },
  { value: "PLANT_OWNER", label: "Plant Owner" }, { value: "ARCHITECT", label: "Architect" },
];
const STATUS_OPTIONS = ["prospect", "active", "customer", "dormant", "lost"] as const;
const STATUS_COLORS: Record<string, string> = {
  prospect: "bg-blue-100 text-blue-700", active: "bg-gate-met-light text-gate-met",
  customer: "bg-green-100 text-green-800", dormant: "bg-pending-light text-pending", lost: "bg-dq-bg text-dq",
};

function fmt$(n: number) { return n > 0 ? "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"; }
function fmtPct(n: number | null) { return n != null ? (n * 100).toFixed(0) + "%" : "—"; }

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MetaItem({ icon: Icon, children, href }: { icon: typeof Phone; children: React.ReactNode; href?: string }) {
  const cls = "flex items-center gap-1 text-xs text-label";
  if (href) return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={`${cls} text-brand hover:underline`}><Icon size={12} />{children}</a>;
  return <span className={cls}><Icon size={12} />{children}</span>;
}

function KvPair({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] text-label uppercase tracking-wider">{label}</p>
      <p className="text-sm text-heading mt-0.5">{value || "—"}</p>
    </div>
  );
}

function JobGroup({ title, opps, navigate }: { title: string; opps: OppRow[]; navigate: (p: string) => void }) {
  if (opps.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className="text-[10px] font-semibold text-label uppercase tracking-wider mb-1">{title} ({opps.length})</h4>
      <div className="space-y-1">
        {opps.map((o) => (
          <button key={o.id} onClick={() => navigate(`/opp/${o.id}`)}
            className="w-full text-left rounded-lg border border-card-border p-2.5 active:bg-gray-50 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-heading truncate">{o.name}</p>
              <p className="text-[10px] text-label">{PIPELINE_LABELS[o.pipeline as Pipeline]} · {STAGE_LABELS[o.stage] ?? o.stage}</p>
            </div>
            {o.amount != null && <span className="text-xs font-medium text-heading shrink-0">{fmt$(o.amount)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main ──

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error, updateCompany, addContact, refetch } = useCompany(id);
  const { kpis, loading: kpisLoading } = useCompanyKpis(id);
  const { notes, addNote } = useCompanyNotes(id);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand" /></div>;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12"><div className="bg-card rounded-2xl p-8" style={{ boxShadow: "var(--shadow-card)" }}>
        <p className="text-brand text-sm mb-4">{error ?? "Not found"}</p>
        <button onClick={() => navigate("/companies")} className="text-sm text-brand font-medium">&larr; Back</button>
      </div></div>
    );
  }

  const { company: co, contacts, opportunities } = data;
  const ongoing = opportunities.filter((o) => o.status === "OPEN");
  const wonInProgress = opportunities.filter((o) => o.status === "WON" && !o.completed_at);
  const completed = opportunities.filter((o) => o.status === "WON" && !!o.completed_at);
  const lost = opportunities.filter((o) => o.status === "LOST");

  const winRateBreakdown = kpis
    ? [kpis.winRatePublicBid != null ? `PB ${fmtPct(kpis.winRatePublicBid)}` : null,
       kpis.winRateGcChase != null ? `GC ${fmtPct(kpis.winRateGcChase)}` : null,
       kpis.winRateFacility != null ? `FAC ${fmtPct(kpis.winRateFacility)}` : null,
      ].filter(Boolean).join(" · ") || "—"
    : "—";

  const fullAddr = [co.address_line1 ?? co.address, co.city, co.state, co.zip].filter(Boolean).join(", ");

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
      <button onClick={() => navigate("/companies")} className="text-sm text-brand font-medium">&larr; Companies</button>

      {/* 1. Header card (read-only) */}
      <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-heading">{co.name}</h1>
              {co.status && (
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[co.status] ?? "bg-gray-100 text-label"}`}>
                  {co.status.charAt(0).toUpperCase() + co.status.slice(1)}
                </span>
              )}
            </div>
            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              {(co.city || co.state) && <MetaItem icon={MapPin}>{co.city && co.state ? `${co.city}, ${co.state}` : co.state ?? co.city}</MetaItem>}
              {co.phone && <MetaItem icon={Phone} href={`tel:${co.phone}`}>{co.phone}</MetaItem>}
              {co.email && <MetaItem icon={Mail} href={`mailto:${co.email}`}>{co.email}</MetaItem>}
              {co.planroom_url && <MetaItem icon={ExternalLink} href={co.planroom_url}>Plan Room</MetaItem>}
            </div>
          </div>
          <button onClick={() => setShowEdit(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-label border border-card-border rounded-lg hover:bg-gray-50 transition-colors">
            <Pencil size={12} /> Edit
          </button>
        </div>

        {/* Key-value grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-card-border">
          <KvPair label="Type" value={TYPE_LABELS[co.type] ?? co.type} />
          <KvPair label="Address" value={fullAddr || null} />
          {co.website && <KvPair label="Website" value={co.website} />}
          {co.linkedin_url && <KvPair label="LinkedIn" value="View profile" />}
        </div>
        {/* Quick links */}
        <div className="flex flex-wrap gap-3 mt-3">
          {co.website && <a href={co.website.startsWith("http") ? co.website : `https://${co.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand"><Globe size={12} />Website</a>}
          {co.linkedin_url && <a href={co.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand"><Link size={12} />LinkedIn</a>}
        </div>
      </div>

      {/* 2. Metrics bar */}
      {!kpisLoading && kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Total Bid $" value={fmt$(kpis.totalBidDollars)} subLabel={kpis.totalBidDollars === 0 ? "No bids yet" : undefined} />
          <KpiCard label="Total Won $" value={fmt$(kpis.totalWonDollars)} subLabel={kpis.totalWonDollars === 0 ? "Awaiting first win" : undefined} />
          <KpiCard label="Avg Bid Size" value={kpis.avgBidSize != null ? fmt$(kpis.avgBidSize) : "—"} />
          <KpiCard label="Win Rate" value={winRateBreakdown} ring={kpis.winRateCount}
            subLabel={kpis.decidedCount > 0 ? `${kpis.wonCount}W / ${kpis.decidedCount} decided` : "Awaiting results"} />
        </div>
      )}

      {/* 3. Split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* LEFT */}
        <div className="space-y-4">
          {/* Jobs */}
          <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-xs font-semibold text-label uppercase tracking-wider">Jobs ({opportunities.length})</h3>
            {opportunities.length === 0 ? (
              <p className="text-sm text-subtle text-center py-6">No jobs linked to this company yet.</p>
            ) : (
              <>
                <JobGroup title="Ongoing" opps={ongoing} navigate={navigate} />
                <JobGroup title="Won — In Progress" opps={wonInProgress} navigate={navigate} />
                <JobGroup title="Completed" opps={completed} navigate={navigate} />
                <JobGroup title="Lost" opps={lost} navigate={navigate} />
              </>
            )}
          </div>

          {/* Contacts */}
          <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-label uppercase tracking-wider">Contacts ({contacts.length})</h3>
              <button onClick={() => setShowAddContact(true)} className="text-xs text-brand font-medium">+ Add Contact</button>
            </div>
            {contacts.length === 0 ? (
              <div className="text-center py-8">
                <UsersIcon size={32} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-subtle">No contacts yet</p>
                <button onClick={() => setShowAddContact(true)} className="text-xs text-brand font-medium mt-1">+ Add Contact</button>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map((c) => (
                  <div key={c.id} className="rounded-lg border border-card-border p-3">
                    <div className="flex items-center justify-between">
                      <button onClick={() => navigate(`/contacts/${c.id}`)} className="font-medium text-sm nav-link truncate text-left">{c.name}</button>
                      <div className="flex items-center gap-1 shrink-0">
                        {c.is_decision_maker && <span className="flex items-center gap-0.5 text-[10px] text-gate-met font-medium"><UserCheck size={12} /> DM</span>}
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-heading">{ROLE_LABELS[c.role]}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-brand"><Phone size={12} /> {c.phone}</a>
                      {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-brand"><Mail size={12} /> Email</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Notes stream */}
        <div className="bg-card rounded-2xl p-5 h-fit" style={{ boxShadow: "var(--shadow-card)" }}>
          <h3 className="text-xs font-semibold text-label uppercase tracking-wider mb-3">Notes</h3>

          {/* Note input */}
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
                  {noteSaving ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setNoteExpanded(true)}
              className="w-full text-left rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-subtle
                         hover:border-brand/40 hover:text-label transition-colors mb-4">
              Add a note...
            </button>
          )}

          {/* Timeline */}
          {notes.length === 0 ? (
            <p className="text-sm text-subtle text-center py-4">No notes yet.</p>
          ) : (
            <div className="space-y-4">
              {notes.map((n) => (
                <div key={n.id} className="flex gap-2.5">
                  <div className="shrink-0 h-7 w-7 rounded-full bg-shell text-white flex items-center justify-center text-[10px] font-semibold mt-0.5">
                    {n.author_initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-heading">{n.author_name}</span>
                      <span className="text-[10px] text-subtle">{relTime(n.created_at)}</span>
                    </div>
                    <p className="text-sm text-heading mt-0.5 whitespace-pre-wrap">{n.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEdit && <EditCompanyModal co={co} onSave={async (fields) => { await updateCompany(fields); await refetch(); setShowEdit(false); }} onClose={() => setShowEdit(false)} />}
      {showAddContact && <AddContactModal onAdd={addContact} onClose={() => setShowAddContact(false)} />}
    </div>
  );
}

// ── Edit Company Modal ──

function EditCompanyModal({ co, onSave, onClose }: {
  co: Database["public"]["Tables"]["companies"]["Row"];
  onSave: (fields: Record<string, string | null>) => Promise<void>;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    name: co.name, phone: co.phone ?? "", email: co.email ?? "", website: co.website ?? "",
    linkedin_url: co.linkedin_url ?? "", planroom_url: co.planroom_url ?? "",
    address_line1: co.address_line1 ?? co.address ?? "", city: co.city ?? "", state: co.state ?? "",
    zip: co.zip ?? "", status: co.status ?? "", type: co.type,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const cls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40";

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name: f.name, phone: f.phone || null, email: f.email || null, website: f.website || null,
      linkedin_url: f.linkedin_url || null, planroom_url: f.planroom_url || null,
      address_line1: f.address_line1 || null, city: f.city || null, state: f.state || null,
      zip: f.zip || null, status: f.status || null, type: f.type,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSave} className="w-full max-w-lg bg-card rounded-2xl p-6 max-h-[90svh] overflow-y-auto" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-heading">Edit Company</h2>
          <button type="button" onClick={onClose} className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        <div className="space-y-3">
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Name</label>
            <input required value={f.name} onChange={(e) => set("name", e.target.value)} className={cls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Type</label>
              <select value={f.type} onChange={(e) => set("type", e.target.value)} className={cls}>
                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Status</label>
              <select value={f.status} onChange={(e) => set("status", e.target.value)} className={cls}>
                <option value="">None</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Phone</label>
              <input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} className={cls} placeholder="313-555-0100" /></div>
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Email</label>
              <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className={cls} placeholder="info@company.com" /></div>
          </div>
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Website</label>
            <input type="url" value={f.website} onChange={(e) => set("website", e.target.value)} className={cls} placeholder="https://example.com" /></div>
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">LinkedIn</label>
            <input type="url" value={f.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} className={cls} placeholder="https://linkedin.com/company/..." /></div>
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Plan Room URL</label>
            <input type="url" value={f.planroom_url} onChange={(e) => set("planroom_url", e.target.value)} className={cls} placeholder="https://planroom..." /></div>
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Address</label>
            <input value={f.address_line1} onChange={(e) => set("address_line1", e.target.value)} className={cls} placeholder="123 Main St" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">City</label>
              <input value={f.city} onChange={(e) => set("city", e.target.value)} className={cls} placeholder="Detroit" /></div>
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">State</label>
              <input value={f.state} onChange={(e) => set("state", e.target.value)} className={cls} placeholder="MI" maxLength={2} /></div>
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">ZIP</label>
              <input value={f.zip} onChange={(e) => set("zip", e.target.value)} className={cls} placeholder="48201" /></div>
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

// ── Add Contact Modal ──

function AddContactModal({ onAdd, onClose }: {
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
    e.preventDefault(); setSub(true); setErr(null);
    const res = await onAdd({ name: name.trim(), role, phone: phone.trim(), email: email.trim() || undefined, is_decision_maker: dm });
    if (res.error) { setErr(res.error); setSub(false); } else onClose();
  };

  const cls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <form onSubmit={handle} className="w-full max-w-lg bg-card rounded-2xl p-6 max-h-[90svh] overflow-y-auto" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-heading">Add Contact</h2>
          <button type="button" onClick={onClose} className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        <label className="block mb-3"><span className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={cls} placeholder="John Smith" /></label>
        <label className="block mb-3"><span className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as ContactRole)} className={cls}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></label>
        <label className="block mb-3"><span className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Phone</span>
          <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={cls} placeholder="313-555-0100" /></label>
        <label className="block mb-3"><span className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Email (optional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={cls} placeholder="john@example.com" /></label>
        <div className="flex items-center justify-between mb-4 py-2">
          <span className="text-sm text-label">Decision Maker?</span>
          <button type="button" onClick={() => setDm(!dm)}
            className={`relative inline-flex h-7 w-12 rounded-full border-2 border-transparent transition-colors ${dm ? "bg-gate-met" : "bg-gray-300"}`}>
            <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${dm ? "translate-x-5" : "translate-x-0"}`} /></button>
        </div>
        {err && <p className="text-brand text-sm mb-3 text-center">{err}</p>}
        <button type="submit" disabled={sub}
          className="w-full rounded-lg bg-brand text-white py-3 text-sm font-medium active:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed">
          {sub ? "Adding..." : "Add Contact"}</button>
      </form>
    </div>
  );
}
