import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useSamGovImport, type SamPreviewItem, type SamImportResult } from "../hooks/useSamGovImport";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function agencyLabel(item: SamPreviewItem): string {
  const first = item.department?.split(".")[0]?.trim();
  return first || item.office || "—";
}

function DescriptionCell({ text }: { text: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <p className="text-xs text-subtle italic">No description available</p>;
  const isLong = text.length > 200;
  return (
    <div>
      <p className="text-xs text-label whitespace-pre-wrap">
        {expanded || !isLong ? text : text.slice(0, 200) + "…"}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-0.5 text-xs text-brand font-medium mt-1"
        >
          {expanded ? <>Show less <ChevronUp size={12} /></> : <>Show more <ChevronDown size={12} /></>}
        </button>
      )}
    </div>
  );
}

export default function SamImportPage() {
  const navigate = useNavigate();
  const { results, requestsUsed, searching, importing, error, pull, importSelected } = useSamGovImport();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    failed: number;
    failures: SamImportResult[];
  } | null>(null);

  const handlePull = async () => {
    setHasSearched(true);
    setImportSummary(null);
    setSelected(new Set());
    await pull();
  };

  const toggleRow = (sol: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sol)) next.delete(sol);
      else next.add(sol);
      return next;
    });
  };

  const allSelected = results.length > 0 && selected.size === results.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(results.map((r) => r.solicitationNumber)));
  };

  const handleImport = async () => {
    const items = results.filter((r) => selected.has(r.solicitationNumber));
    if (items.length === 0) return;

    const { data, error: err } = await importSelected(items);
    if (err || !data) {
      setImportSummary({ imported: 0, failed: items.length, failures: [{ solicitationNumber: "(request)", opportunityId: null, error: err ?? "Import failed" }] });
      return;
    }

    const failures = data.results.filter((r) => r.error !== null);
    setSelected(new Set());
    if (failures.length === 0) {
      navigate("/opportunities?pipeline=FEDERAL");
      return;
    }
    setImportSummary({ imported: data.imported, failed: data.failed, failures });
  };

  return (
    <div className="pb-16 md:pb-6">
      <button onClick={() => navigate("/opportunities?pipeline=FEDERAL")} className="text-sm text-brand font-medium mb-3">
        &larr; Pipeline
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-heading">SAM.gov Import</h1>
          <p className="text-xs text-label mt-0.5">
            Searches flooring/coating NAICS codes and SDVOSB set-asides, hides anything already imported.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {results.length > 0 && (
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium active:bg-brand-hover disabled:opacity-50"
            >
              {importing ? "Importing…" : `Import Selected (${selected.size})`}
            </button>
          )}
          <button
            onClick={handlePull}
            disabled={searching || importing}
            className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card text-heading px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <Search size={14} /> {hasSearched ? "Search Again" : "Search SAM.gov"}
          </button>
        </div>
      </div>

      {requestsUsed !== null && (
        <p className="text-[10px] text-subtle mb-2">
          {requestsUsed} SAM.gov API request{requestsUsed === 1 ? "" : "s"} used this run (limit 1,000/day)
        </p>
      )}

      {importSummary && (
        <div className="rounded-xl border border-pending/40 bg-pending-light/40 p-4 mb-4">
          <p className="text-sm font-medium text-heading">
            Imported {importSummary.imported}, {importSummary.failed} failed
          </p>
          <ul className="mt-1 space-y-0.5">
            {importSummary.failures.map((f) => (
              <li key={f.solicitationNumber} className="text-xs text-label">
                <span className="font-medium">{f.solicitationNumber}</span>: {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {searching ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          <p className="text-sm text-label">Searching SAM.gov — this runs 12 queries and can take a minute…</p>
        </div>
      ) : error ? (
        <div className="bg-card rounded-xl shadow-sm p-8 text-center">
          <p className="text-brand text-sm">{error}</p>
        </div>
      ) : !hasSearched ? (
        <div className="bg-card rounded-xl shadow-sm p-12 text-center">
          <Search size={32} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-label">
            Click "Search SAM.gov" to pull current federal opportunities.
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm p-12 text-center">
          <p className="text-sm text-label">No new opportunities found — everything matching is already imported.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-brand focus:ring-brand h-4 w-4"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-label uppercase tracking-wide">Opportunity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-label uppercase tracking-wide">Agency</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-label uppercase tracking-wide">NAICS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-label uppercase tracking-wide">Set-Aside</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-label uppercase tracking-wide">Posted</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-label uppercase tracking-wide">Deadline</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {results.map((r) => (
                  <tr key={r.solicitationNumber} className="align-top hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.solicitationNumber)}
                        onChange={() => toggleRow(r.solicitationNumber)}
                        className="rounded border-gray-300 text-brand focus:ring-brand h-4 w-4"
                      />
                    </td>
                    <td className="px-4 py-3 min-w-[280px] max-w-[420px]">
                      <p className="font-medium text-heading">{r.title}</p>
                      <p className="text-[10px] text-subtle mb-1">{r.solicitationNumber}</p>
                      <DescriptionCell text={r.descriptionText} />
                    </td>
                    <td className="px-4 py-3 text-label whitespace-nowrap">{agencyLabel(r)}</td>
                    <td className="px-4 py-3 text-label">{r.naicsCode ?? "—"}</td>
                    <td className="px-4 py-3 text-label">{r.setAsideType ?? "—"}</td>
                    <td className="px-4 py-3 text-label whitespace-nowrap">{fmtDate(r.postedDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-heading">{fmtDate(r.responseDeadline)}</td>
                    <td className="px-4 py-3">
                      {r.samUrl && (
                        <a
                          href={r.samUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View on SAM.gov"
                          className="text-brand hover:opacity-70 inline-flex"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
