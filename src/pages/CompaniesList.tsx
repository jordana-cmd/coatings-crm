import { useState, useMemo, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanyList, type CompanyListItem } from "../hooks/useCompanyList";
import { Search } from "lucide-react";
import type { Database } from "../lib/database.types";

type CompanyType = Database["public"]["Enums"]["company_type"];

const TYPE_LABELS: Record<CompanyType, string> = {
  GC: "GC", AWARDING_AUTHORITY: "Authority", PLANT_OWNER: "Plant Owner", ARCHITECT: "Architect",
};
const TYPE_OPTIONS: { value: CompanyType; label: string }[] = [
  { value: "GC", label: "GC" },
  { value: "AWARDING_AUTHORITY", label: "Awarding Authority" },
  { value: "PLANT_OWNER", label: "Plant Owner" },
  { value: "ARCHITECT", label: "Architect" },
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Sorting ──

type SortKey = "name" | "type" | "city" | "state" | "jobs_out_for_bid" | "last_activity_at";
type SortDir = "asc" | "desc";

function sortCompanies(list: CompanyListItem[], key: SortKey, dir: SortDir): CompanyListItem[] {
  return [...list].sort((a, b) => {
    let av: string | number | null;
    let bv: string | number | null;

    switch (key) {
      case "name": av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
      case "type": av = a.type; bv = b.type; break;
      case "city": av = a.city?.toLowerCase() ?? null; bv = b.city?.toLowerCase() ?? null; break;
      case "state": av = a.state?.toLowerCase() ?? null; bv = b.state?.toLowerCase() ?? null; break;
      case "jobs_out_for_bid": av = a.jobs_out_for_bid; bv = b.jobs_out_for_bid; break;
      case "last_activity_at": av = a.last_activity_at; bv = b.last_activity_at; break;
    }

    // Nulls last regardless of direction
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;

    let cmp: number;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ── Table header ──

function Th({ label, sortKey, active, dir, onSort }: {
  label: string; sortKey: SortKey; active: boolean; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  return (
    <th className="px-4 py-3 text-left text-xs font-medium text-label uppercase tracking-wide cursor-pointer select-none hover:text-heading"
      onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (
          <span className="text-brand text-[10px]">{dir === "asc" ? "\u25B2" : "\u25BC"}</span>
        )}
      </span>
    </th>
  );
}

// ── Main ──

const TYPE_FILTER_OPTIONS: { value: CompanyType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "GC", label: "GC" },
  { value: "AWARDING_AUTHORITY", label: "Authority" },
  { value: "PLANT_OWNER", label: "Plant Owner" },
  { value: "ARCHITECT", label: "Architect" },
];

export default function CompaniesList() {
  const { companies, loading, createCompany } = useCompanyList();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CompanyType | "ALL">("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("last_activity_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const navigate = useNavigate();

  const filtered = companies.filter((c) => {
    if (typeFilter !== "ALL" && c.type !== typeFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = useMemo(() => sortCompanies(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "jobs_out_for_bid" || key === "last_activity_at" ? "desc" : "asc");
    }
  };

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
        <h1 className="text-xl font-semibold text-heading">Companies</h1>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium active:bg-brand-hover">
          + New
        </button>
      </div>

      {/* Type filter pills */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {TYPE_FILTER_OPTIONS.map((f) => (
          <button key={f.value} onClick={() => setTypeFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors
              ${typeFilter === f.value ? "bg-brand text-white" : "bg-gray-100 text-label hover:text-heading"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-label" />
        <input type="text" placeholder="Search companies..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card rounded-lg border border-card-border pl-9 pr-3 py-2.5 text-sm text-heading
                     focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40" />
      </div>

      <p className="text-[10px] text-subtle mb-2">{sorted.length} of {companies.length} companies</p>

      {sorted.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm p-12 text-center">
          <p className="text-label">{search || typeFilter !== "ALL" ? "No companies match — try clearing a filter" : "No companies yet."}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border">
                    <Th label="Company" sortKey="name" active={sortKey === "name"} dir={sortDir} onSort={handleSort} />
                    <Th label="Type" sortKey="type" active={sortKey === "type"} dir={sortDir} onSort={handleSort} />
                    <Th label="City" sortKey="city" active={sortKey === "city"} dir={sortDir} onSort={handleSort} />
                    <Th label="State" sortKey="state" active={sortKey === "state"} dir={sortDir} onSort={handleSort} />
                    <Th label="Out for Bid" sortKey="jobs_out_for_bid" active={sortKey === "jobs_out_for_bid"} dir={sortDir} onSort={handleSort} />
                    <Th label="Last Activity" sortKey="last_activity_at" active={sortKey === "last_activity_at"} dir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {sorted.map((c) => (
                    <tr key={c.id} onClick={() => navigate(`/companies/${c.id}`)}
                      className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 font-medium nav-link">{c.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-heading">
                          {TYPE_LABELS[c.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-label">{c.city ?? "—"}</td>
                      <td className="px-4 py-3 text-label">{c.state ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          c.jobs_out_for_bid > 0 ? "bg-brand-light text-brand" : "bg-gray-100 text-subtle"
                        }`}>
                          {c.jobs_out_for_bid}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-label text-xs">
                        {c.last_activity_at ? fmtDate(c.last_activity_at) : <span className="text-subtle">None</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-card-border">
              {sorted.map((c) => (
                <button key={c.id} onClick={() => navigate(`/companies/${c.id}`)}
                  className="w-full text-left px-5 py-4 active:bg-gray-50">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium text-sm nav-link truncate">{c.name}</p>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-heading shrink-0">
                        {TYPE_LABELS[c.type]}
                      </span>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      c.jobs_out_for_bid > 0 ? "bg-brand-light text-brand" : "bg-gray-100 text-subtle"
                    }`}>
                      {c.jobs_out_for_bid} out for bid
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-label">{c.location}</p>
                    <p className="text-[10px] text-subtle shrink-0">
                      {c.last_activity_at ? `Last: ${fmtDate(c.last_activity_at)}` : "No activity yet"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {showCreate && <CreateCompanyModal onCreate={createCompany} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateCompanyModal({
  onCreate,
  onClose,
}: {
  onCreate: (input: { name: string; type: CompanyType; region: string; address: string; city?: string; state?: string }) => Promise<{ error: string | null }>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CompanyType>("GC");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const st = state.trim().toUpperCase();
    const res = await onCreate({
      name: name.trim(), type,
      region: st || "—",
      address: address.trim(),
      city: city.trim() || undefined,
      state: st || undefined,
    });
    if (res.error) { setError(res.error); setSubmitting(false); }
    else onClose();
  };

  const cls = "w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl p-6 max-h-[90svh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-heading">New Company</h2>
          <button type="button" onClick={onClose} className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        <label className="block mb-3">
          <span className="block text-xs text-label mb-1">Company Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={cls} placeholder="e.g. Turner Construction" />
        </label>
        <label className="block mb-3">
          <span className="block text-xs text-label mb-1">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as CompanyType)} className={cls}>
            {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="block text-xs text-label mb-1">City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} className={cls} placeholder="Detroit" />
          </label>
          <label className="block">
            <span className="block text-xs text-label mb-1">State</span>
            <input value={state} onChange={(e) => setState(e.target.value)} className={cls} placeholder="MI" maxLength={2} />
          </label>
        </div>
        <label className="block mb-4">
          <span className="block text-xs text-label mb-1">Address</span>
          <input required value={address} onChange={(e) => setAddress(e.target.value)} className={cls} placeholder="123 Main St, Detroit, MI" />
        </label>
        {error && <p className="text-brand text-sm mb-3 text-center">{error}</p>}
        <button type="submit" disabled={submitting}
          className="w-full rounded-lg bg-brand text-white py-3 text-sm font-medium active:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? "Creating..." : "Create Company"}
        </button>
      </form>
    </div>
  );
}
