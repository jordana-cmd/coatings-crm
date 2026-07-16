import { useState, type FormEvent } from "react";
import { useCompanies } from "../../hooks/useOpportunities";
import type { Database } from "../../lib/database.types";

type CompanyType = Database["public"]["Enums"]["company_type"];

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: "GC", label: "GC" },
  { value: "AWARDING_AUTHORITY", label: "Awarding Authority" },
  { value: "OWNER", label: "Owner" },
  { value: "ARCHITECT", label: "Architect" },
  { value: "GOVERNMENT_AGENCY", label: "Government Agency" },
];

interface Props {
  pipeline?: string;
  onSubmit: (input: {
    name: string;
    pipeline?: string;
    company_id: string;
    job_site_address: string;
    amount?: number | null;
  }) => Promise<{ error: string | null }>;
  onClose: () => void;
}

export default function CreateOppForm({ pipeline, onSubmit, onClose }: Props) {
  const { companies, loading: companiesLoading, createCompany } = useCompanies();

  const [name, setName] = useState("");
  const [jobSite, setJobSite] = useState("");
  const [amount, setAmount] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [addingCompany, setAddingCompany] = useState(false);
  const [newCoName, setNewCoName] = useState("");
  const [newCoType, setNewCoType] = useState<CompanyType>("GC");
  const [newCoRegion, setNewCoRegion] = useState("");
  const [newCoAddress, setNewCoAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    let finalCompanyId = companyId;

    if (addingCompany) {
      if (!newCoName.trim() || !newCoRegion.trim() || !newCoAddress.trim()) {
        setError("Fill in all company fields");
        setSubmitting(false);
        return;
      }
      const { data, error: coErr } = await createCompany({
        name: newCoName.trim(),
        type: newCoType,
        region: newCoRegion.trim(),
        address: newCoAddress.trim(),
      });
      if (coErr || !data) {
        setError(coErr ?? "Failed to create company");
        setSubmitting(false);
        return;
      }
      finalCompanyId = data.id;
    }

    if (!finalCompanyId) {
      setError("Select or add a company");
      setSubmitting(false);
      return;
    }

    const result = await onSubmit({
      name: name.trim(),
      pipeline,
      company_id: finalCompanyId,
      job_site_address: jobSite.trim(),
      amount: amount ? parseFloat(amount) : null,
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl p-6 max-h-[90svh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-heading">
            New {pipeline === "FEDERAL" ? "Federal" : pipeline === "GC_CHASE" ? "GC Chase" : pipeline === "FACILITY" ? "Facility" : "Public Bid"} Opportunity
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <label className="block mb-3">
          <span className="block text-sm font-medium text-label mb-1">
            Project Name
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. City Hall Garage Floor"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-sm font-medium text-label mb-1">
            Job Site Address
          </span>
          <input
            required
            value={jobSite}
            onChange={(e) => setJobSite(e.target.value)}
            className={inputClass}
            placeholder="123 Main St, Detroit, MI"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-sm font-medium text-label mb-1">
            Amount (optional)
          </span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            placeholder="$"
          />
        </label>

        {/* Company picker */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-label">Company</span>
            <button
              type="button"
              onClick={() => {
                setAddingCompany(!addingCompany);
                setCompanyId("");
              }}
              className="text-sm text-brand font-medium"
            >
              {addingCompany ? "Pick existing" : "+ Add new"}
            </button>
          </div>

          {addingCompany ? (
            <div className="space-y-2 rounded-lg border border-gray-200 p-3 bg-gray-50">
              <input
                required
                value={newCoName}
                onChange={(e) => setNewCoName(e.target.value)}
                className={inputClass}
                placeholder="Company name"
              />
              <select
                value={newCoType}
                onChange={(e) => setNewCoType(e.target.value as CompanyType)}
                className={inputClass}
              >
                {COMPANY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                required
                value={newCoRegion}
                onChange={(e) => setNewCoRegion(e.target.value)}
                className={inputClass}
                placeholder="Region (e.g. MI)"
              />
              <input
                required
                value={newCoAddress}
                onChange={(e) => setNewCoAddress(e.target.value)}
                className={inputClass}
                placeholder="Company address"
              />
            </div>
          ) : (
            <select
              required={!addingCompany}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className={inputClass}
              disabled={companiesLoading}
            >
              <option value="">
                {companiesLoading ? "Loading..." : "Select a company"}
              </option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-3 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand text-white py-3 text-base font-medium
                     active:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating..." : "Create Opportunity"}
        </button>
      </form>
    </div>
  );
}
