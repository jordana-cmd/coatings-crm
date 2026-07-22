import { useNavigate } from "react-router-dom";
import { RefreshCw, Inbox, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useImports, type ImportedDeal } from "../hooks/useImports";
import { STAGE_LABELS } from "../lib/pipelines";

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-subtle">—</span>;
  const cls = verdict === "BID" ? "bg-brand-light text-brand" : "bg-pending-light text-pending";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>{verdict}</span>;
}

function StatusBanner({ status }: { status: ReturnType<typeof useImports>["shipStatus"] }) {
  if (!status) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-4 mb-4 flex items-center gap-3">
        <Inbox size={18} className="text-subtle shrink-0" />
        <p className="text-sm text-label">
          No ship runs recorded yet. The shipper reports here each time it pushes folders from <code>crm-inbox\</code>.
        </p>
      </div>
    );
  }
  const pending = status.failed;
  const clean = pending === 0;
  return (
    <div
      className={`rounded-xl border p-4 mb-4 ${
        clean ? "border-gate-met/20 bg-gate-met-light/40" : "border-pending/40 bg-pending-light/40"
      }`}
    >
      <div className="flex items-center gap-2">
        {clean ? (
          <CheckCircle2 size={18} className="text-gate-met shrink-0" />
        ) : (
          <AlertTriangle size={18} className="text-pending shrink-0" />
        )}
        <p className="text-sm font-medium text-heading">
          {clean
            ? "No folders pending in crm-inbox"
            : `${pending} folder${pending === 1 ? "" : "s"} pending in crm-inbox`}
        </p>
      </div>
      <p className="text-xs text-label mt-1">
        Last ship {fmtWhen(status.ranAt)} · {status.foldersFound} found ·{" "}
        {status.created} created, {status.updated} updated, {status.skipped} skipped
        {pending > 0 ? `, ${pending} failed (will re-ship next run)` : ""}
      </p>
      {status.errors && status.errors.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {status.errors.map((e) => (
            <li key={e.folder} className="text-xs text-label">
              <span className="font-medium">{e.folder}</span>: {e.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ImportsPage() {
  const navigate = useNavigate();
  const { deals, shipStatus, loading, error, refetch } = useImports();

  return (
    <div className="pb-16 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-heading">PlanHub Imports</h1>
          <p className="text-xs text-label mt-0.5">
            Deals shipped from the daily PlanHub qualifier into the GC Chase pipeline.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card text-heading px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 self-start"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <StatusBanner status={shipStatus} />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
        </div>
      ) : error ? (
        <div className="bg-card rounded-xl shadow-sm p-8 text-center">
          <p className="text-brand text-sm">{error}</p>
        </div>
      ) : deals.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm p-12 text-center">
          <Inbox size={32} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-label">No PlanHub deals imported yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  {["Project", "GC", "Verdict", "Rev", "Stage", "Imported", "Updated"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-label uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {deals.map((d: ImportedDeal) => (
                  <tr
                    key={d.planhubId}
                    className={`align-top ${d.opportunityId ? "hover:bg-gray-50 cursor-pointer" : ""}`}
                    onClick={() => d.opportunityId && navigate(`/opp/${d.opportunityId}`)}
                  >
                    <td className="px-4 py-3 min-w-[220px]">
                      <p className="font-medium text-heading">{d.projectName ?? "(opportunity removed)"}</p>
                      <p className="text-[10px] text-subtle">PlanHub #{d.planhubId}</p>
                    </td>
                    <td className="px-4 py-3 text-label whitespace-nowrap">{d.companyName ?? "—"}</td>
                    <td className="px-4 py-3"><VerdictBadge verdict={d.verdict} /></td>
                    <td className="px-4 py-3 text-label">{d.revision}</td>
                    <td className="px-4 py-3 text-label whitespace-nowrap">
                      {d.stage ? (STAGE_LABELS[d.stage] ?? d.stage) : "—"}
                    </td>
                    <td className="px-4 py-3 text-label whitespace-nowrap">{fmtWhen(d.importedAt)}</td>
                    <td className="px-4 py-3 text-label whitespace-nowrap">{fmtWhen(d.updatedAt)}</td>
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
