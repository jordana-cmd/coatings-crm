import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useContactList, fetchAllFilteredContacts, type ContactFilters, type LastContactedFilter, type ContactWithCompany } from "../hooks/useContacts";
import Pagination, { type PageSize } from "../components/ui/Pagination";
import { supabase } from "../lib/supabase";
import { Search, Phone, Mail, UserCheck, ExternalLink, Download } from "lucide-react";
import type { Database } from "../lib/database.types";

type ContactRole = Database["public"]["Enums"]["contact_role"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

const ROLE_LABELS: Record<ContactRole, string> = {
  PM: "PM", ESTIMATOR: "Estimator", SUPER: "Super", FM: "FM",
  PURCHASING: "Purchasing", SPEC_WRITER: "Spec Writer",
};
const ROLE_OPTIONS: ContactRole[] = ["PM", "ESTIMATOR", "SUPER", "FM", "PURCHASING", "SPEC_WRITER"];

const LAST_CONTACTED_OPTIONS: { value: LastContactedFilter; label: string }[] = [
  { value: "ANY", label: "Any" },
  { value: "7D", label: "Within 7 days" },
  { value: "30D", label: "Within 30 days" },
  { value: "90PLUS", label: "90+ days ago" },
  { value: "NEVER", label: "Never contacted" },
];

// ── CSV helpers ──

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

interface ExportColumn {
  key: string;
  label: string;
  getter: (c: ContactWithCompany) => string;
}

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "first_name", label: "First Name", getter: (c) => c.name.split(" ")[0] ?? "" },
  { key: "last_name", label: "Last Name", getter: (c) => c.name.split(" ").slice(1).join(" ") ?? "" },
  { key: "title", label: "Title", getter: (c) => c.title ?? "" },
  { key: "role", label: "Role", getter: (c) => c.role },
  { key: "company", label: "Company", getter: (c) => c.company_name ?? "" },
  { key: "phone", label: "Phone", getter: (c) => c.phone ?? "" },
  { key: "email", label: "Email", getter: (c) => c.email ?? "" },
  { key: "city", label: "City", getter: (c) => c.city ?? "" },
  { key: "state", label: "State", getter: (c) => c.state ?? "" },
  { key: "linkedin_url", label: "LinkedIn URL", getter: (c) => c.linkedin_url ?? "" },
  { key: "decision_maker", label: "Decision Maker", getter: (c) => c.is_decision_maker ? "Yes" : "No" },
  { key: "favorite", label: "Favorite", getter: (c) => c.is_favorite ? "Yes" : "No" },
  { key: "last_contacted", label: "Last Contacted", getter: (c) => c.last_contacted_at ? new Date(c.last_contacted_at).toLocaleDateString() : "" },
];

function generateCsv(rows: ContactWithCompany[], columns: ExportColumn[]): string {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => csvEscape(c.getter(r))).join(",")).join("\n");
  return header + "\n" + body;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Export Modal ──

function ExportModal({ totalCount, filters, onClose }: {
  totalCount: number; filters: ContactFilters; onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(EXPORT_COLUMNS.map((c) => c.key)));
  const [exporting, setExporting] = useState(false);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    setExporting(true);
    const rows = await fetchAllFilteredContacts(filters);
    const cols = EXPORT_COLUMNS.filter((c) => selected.has(c.key));
    const csv = generateCsv(rows, cols);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `contacts_export_${date}.csv`);
    setExporting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-5 max-h-[85svh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-heading">Export Contacts</h2>
          <button onClick={onClose} className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        <p className="text-xs text-label mb-3">
          Export <span className="font-semibold text-heading">{totalCount}</span> contacts matching current filters
        </p>
        <div className="space-y-1.5 mb-4">
          {EXPORT_COLUMNS.map((col) => (
            <label key={col.key} className="flex items-center gap-2.5 cursor-pointer py-0.5">
              <input type="checkbox" checked={selected.has(col.key)}
                onChange={() => toggle(col.key)}
                className="rounded border-gray-300 text-brand focus:ring-brand h-3.5 w-3.5" />
              <span className="text-sm text-heading">{col.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-label hover:text-heading">Cancel</button>
          <button onClick={handleExport} disabled={exporting || selected.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg active:bg-brand-hover disabled:opacity-50">
            <Download size={14} />
            {exporting ? "Exporting..." : `Export ${totalCount} contacts`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──

export default function ContactsList() {
  const [roleFilter, setRoleFilter] = useState<ContactRole | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [lastContactedFilter, setLastContactedFilter] = useState<LastContactedFilter>("ANY");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [showCreate, setShowCreate] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const navigate = useNavigate();

  const filters: ContactFilters = { role: roleFilter, search, includeArchived: showArchived, lastContacted: lastContactedFilter };
  const { contacts, totalCount, loading, createContact } = useContactList(filters, page, pageSize);

  // Reset to page 0 when filters change
  const setRoleAndReset = (v: ContactRole | "ALL") => { setRoleFilter(v); setPage(0); };
  const setSearchAndReset = (v: string) => { setSearch(v); setPage(0); };
  const setArchivedAndReset = (v: boolean) => { setShowArchived(v); setPage(0); };
  const setLastContactedAndReset = (v: LastContactedFilter) => { setLastContactedFilter(v); setPage(0); };
  const setPageSizeAndReset = (s: PageSize) => { setPageSize(s); setPage(0); };

  return (
    <div className="pb-16 md:pb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-heading">Contacts</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowExport(true)}
            className="flex items-center gap-1 rounded-lg border border-card-border px-3 py-2 text-sm font-medium text-label hover:text-heading active:bg-gray-50">
            <Download size={14} /> Export
          </button>
          <button onClick={() => setShowCreate(true)}
            className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium active:bg-brand-hover">
            + New
          </button>
        </div>
      </div>

      {/* Role filter pills */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        <button onClick={() => setRoleAndReset("ALL")}
          className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors
            ${roleFilter === "ALL" ? "bg-brand text-white" : "bg-gray-100 text-label hover:text-heading"}`}>
          All
        </button>
        {ROLE_OPTIONS.map((r) => (
          <button key={r} onClick={() => setRoleAndReset(r)}
            className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors
              ${roleFilter === r ? "bg-brand text-white" : "bg-gray-100 text-label hover:text-heading"}`}>
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Search + Last Contacted filter */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-label" />
          <input type="text" placeholder="Search name, title, or company..." value={search}
            onChange={(e) => setSearchAndReset(e.target.value)}
            className="w-full bg-card rounded-lg border border-card-border pl-9 pr-3 py-2.5 text-sm text-heading
                       focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40" />
        </div>
        <select value={lastContactedFilter} onChange={(e) => setLastContactedAndReset(e.target.value as LastContactedFilter)}
          className="bg-card rounded-lg border border-card-border px-3 py-2.5 text-sm text-heading
                     focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40 shrink-0">
          {LAST_CONTACTED_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-subtle">{totalCount} contacts</p>
        <label className="flex items-center gap-1.5 text-[10px] text-label cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={(e) => setArchivedAndReset(e.target.checked)}
            className="rounded border-gray-300 text-brand focus:ring-brand h-3 w-3" />
          Show archived
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-shell-border border-t-brand" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm p-12 text-center">
          <p className="text-label">No contacts match — try clearing a filter</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-card-border">
            {contacts.map((c) => (
              <div key={c.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <button onClick={() => navigate(`/contacts/${c.id}`)}
                  className="min-w-0 text-left flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm nav-link truncate">{c.name}</p>
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
                <div className="flex items-center gap-1 shrink-0">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="p-2 text-brand rounded-lg hover:bg-brand-light">
                      <Phone size={16} />
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="p-2 text-brand rounded-lg hover:bg-brand-light">
                      <Mail size={16} />
                    </a>
                  )}
                  {c.linkedin_url && (
                    <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 text-blue-600 rounded-lg hover:bg-blue-50"
                      title="LinkedIn">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 pb-3">
            <Pagination page={page} pageSize={pageSize} totalCount={totalCount}
              onPageChange={setPage} onPageSizeChange={setPageSizeAndReset} />
          </div>
        </div>
      )}

      {showCreate && <CreateContactModal onCreate={createContact} onClose={() => setShowCreate(false)} />}
      {showExport && <ExportModal totalCount={totalCount} filters={filters} onClose={() => setShowExport(false)} />}
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
