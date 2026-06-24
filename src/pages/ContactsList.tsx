import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useContactList } from "../hooks/useContacts";
import { supabase } from "../lib/supabase";
import { Search, Phone, Mail, UserCheck } from "lucide-react";
import type { Database } from "../lib/database.types";

type ContactRole = Database["public"]["Enums"]["contact_role"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

const ROLE_LABELS: Record<ContactRole, string> = {
  PM: "PM", ESTIMATOR: "Estimator", SUPER: "Super", FM: "FM",
  PURCHASING: "Purchasing", SPEC_WRITER: "Spec Writer",
};
const ROLE_OPTIONS: ContactRole[] = ["PM", "ESTIMATOR", "SUPER", "FM", "PURCHASING", "SPEC_WRITER"];

export default function ContactsList() {
  const { contacts, loading, createContact } = useContactList();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const filtered = search
    ? contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : contacts;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-shell-border border-t-brand" />
      </div>
    );
  }

  return (
    <div className="pb-16 md:pb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Contacts</h1>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium active:bg-brand-hover">
          + New
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-label" />
        <input type="text" placeholder="Search contacts..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card rounded-lg border border-card-border pl-9 pr-3 py-2.5 text-sm text-heading
                     focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm p-12 text-center">
          <p className="text-label">{search ? "No matches" : "No contacts yet."}</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-card-border">
            {filtered.map((c) => (
              <div key={c.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <button onClick={() => navigate(`/contacts/${c.id}`)}
                  className="min-w-0 text-left flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-heading truncate">{c.name}</p>
                    {c.is_decision_maker && (
                      <span className="flex items-center gap-0.5 text-[10px] text-gate-met font-medium shrink-0">
                        <UserCheck size={10} /> DM
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-label truncate">
                    {ROLE_LABELS[c.role]} · {c.company_name ?? "—"}
                  </p>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={`tel:${c.phone}`} className="p-2 text-brand rounded-lg hover:bg-brand-light">
                    <Phone size={16} />
                  </a>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="p-2 text-brand rounded-lg hover:bg-brand-light">
                      <Mail size={16} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && <CreateContactModal onCreate={createContact} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateContactModal({
  onCreate,
  onClose,
}: {
  onCreate: (input: { company_id: string; name: string; role: ContactRole; phone: string; email?: string; is_decision_maker?: boolean }) => Promise<{ error: string | null }>;
  onClose: () => void;
}) {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ContactRole>("PM");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dm, setDm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sub, setSub] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("companies").select("*").order("name").then(({ data }) => setCompanies(data ?? []));
  }, []);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) { setErr("Select a company"); return; }
    setSub(true); setErr(null);
    const res = await onCreate({
      company_id: companyId, name: name.trim(), role, phone: phone.trim(),
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
          <h2 className="text-lg font-bold text-heading">New Contact</h2>
          <button type="button" onClick={onClose} className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        <label className="block mb-3">
          <span className="block text-xs text-label mb-1">Company</span>
          <select required value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={cls}>
            <option value="">Select a company</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
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
          className="w-full rounded-lg bg-brand text-white py-3 text-sm font-medium active:bg-brand-hover disabled:opacity-50">
          {sub ? "Adding..." : "Add Contact"}
        </button>
      </form>
    </div>
  );
}
