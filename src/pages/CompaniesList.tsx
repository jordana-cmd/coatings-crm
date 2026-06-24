import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanyList } from "../hooks/useCompanyList";
import { Search } from "lucide-react";
import type { Database } from "../lib/database.types";

type CompanyType = Database["public"]["Enums"]["company_type"];

const TYPE_LABELS: Record<CompanyType, string> = {
  GC: "GC",
  AWARDING_AUTHORITY: "Authority",
  PLANT_OWNER: "Plant Owner",
  ARCHITECT: "Architect",
};
const TYPE_OPTIONS: { value: CompanyType; label: string }[] = [
  { value: "GC", label: "GC" },
  { value: "AWARDING_AUTHORITY", label: "Awarding Authority" },
  { value: "PLANT_OWNER", label: "Plant Owner" },
  { value: "ARCHITECT", label: "Architect" },
];

export default function CompaniesList() {
  const { companies, loading, createCompany } = useCompanyList();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const filtered = search
    ? companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : companies;

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
        <h1 className="text-xl font-bold text-white">Companies</h1>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium active:bg-brand-hover">
          + New
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-label" />
        <input type="text" placeholder="Search companies..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card rounded-lg border border-card-border pl-9 pr-3 py-2.5 text-sm text-heading
                     focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm p-12 text-center">
          <p className="text-label">{search ? "No matches" : "No companies yet."}</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-card-border">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => navigate(`/companies/${c.id}`)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-3
                           hover:bg-gray-50 active:bg-gray-50">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-heading truncate">{c.name}</p>
                  <p className="text-xs text-label">{c.region}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-heading">
                    {TYPE_LABELS[c.type]}
                  </span>
                  {c.opp_count > 0 && (
                    <span className="text-xs text-label">{c.opp_count} opp{c.opp_count !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showCreate && <CreateCompanyModal onCreate={createCompany} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateCompanyModal({
  onCreate,
  onClose,
}: {
  onCreate: (input: { name: string; type: CompanyType; region: string; address: string }) => Promise<{ error: string | null }>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CompanyType>("GC");
  const [region, setRegion] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await onCreate({ name: name.trim(), type, region: region.trim(), address: address.trim() });
    if (res.error) { setError(res.error); setSubmitting(false); }
    else onClose();
  };

  const inputCls = "w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl p-6 max-h-[90svh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-heading">New Company</h2>
          <button type="button" onClick={onClose} className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        <label className="block mb-3">
          <span className="block text-xs text-label mb-1">Company Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Turner Construction" />
        </label>
        <label className="block mb-3">
          <span className="block text-xs text-label mb-1">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as CompanyType)} className={inputCls}>
            {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block mb-3">
          <span className="block text-xs text-label mb-1">Region</span>
          <input required value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls} placeholder="e.g. MI" />
        </label>
        <label className="block mb-4">
          <span className="block text-xs text-label mb-1">Address</span>
          <input required value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="123 Main St, Detroit, MI" />
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
