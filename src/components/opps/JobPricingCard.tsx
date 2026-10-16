import { FolderOpen, FileText, ExternalLink } from "lucide-react";
import type { useJobPricing, EstimateRow, SubQuoteRow } from "../../hooks/usePricingIntel";

interface Props {
  pricing: ReturnType<typeof useJobPricing>;
  /** opportunities.drive_folder_url — the job folder in MCFC Brain. */
  driveFolderUrl: string | null;
  /** Our bid amount, for the sub-quote comparison. */
  ourAmount: number | null;
}

const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const psf = (n: number | null | undefined) => (n == null ? "" : `$${Number(n).toFixed(2)}/SF`);
const shortDate = (s: string | null) =>
  s ? new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }) : "";

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700",
  DRAFT: "bg-gray-100 text-label",
  INCOMPLETE: "bg-amber-50 text-amber-700",
  SUPERSEDED: "bg-gray-50 text-subtle line-through",
};

function EstimateLine({ e }: { e: EstimateRow }) {
  const price = e.approved_price ?? e.recommended_price;
  const mh = e.man_hours ?? (e.crew && e.hours_per_man ? Number(e.crew) * Number(e.hours_per_man) : null);
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-card-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-heading truncate">
          v{e.version} · {e.system}
          {e.area_label ? ` · ${e.area_label}` : ""}
        </p>
        <p className="text-[11px] text-subtle">
          {e.square_feet ? `${Number(e.square_feet).toLocaleString()} SF` : "SF missing"}
          {mh ? ` · ${Math.round(Number(mh))} MH` : ""}
          {e.square_feet && mh ? ` · ${(Number(e.square_feet) / Number(mh)).toFixed(1)} SF/MH` : ""}
          {" · "}
          {shortDate(e.created_at)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-heading">{money(price)}</p>
        <p className="text-[11px] text-subtle">{psf(e.price_per_sf)}</p>
        <span className={`inline-block mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[e.status] ?? "bg-gray-100 text-label"}`}>
          {e.status}
        </span>
        {e.pricing_sheet_url && (
          <a href={e.pricing_sheet_url} target="_blank" rel="noreferrer" className="ml-1 text-[10px] text-brand underline">
            sheet
          </a>
        )}
      </div>
    </div>
  );
}

function SubQuoteLine({ q, ourAmount }: { q: SubQuoteRow; ourAmount: number | null }) {
  const delta = ourAmount ? (ourAmount - Number(q.amount)) / Number(q.amount) : null;
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-card-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-heading truncate">
          {q.sub_name}
          {q.is_selected && (
            <span className="ml-1.5 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">carried</span>
          )}
        </p>
        <p className="text-[11px] text-subtle truncate">
          {[q.system, q.square_feet ? `${Number(q.square_feet).toLocaleString()} SF` : null, shortDate(q.received_at)]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {q.scope_notes && <p className="text-[11px] text-label mt-0.5 line-clamp-2">{q.scope_notes}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-heading">{money(q.amount)}</p>
        <p className="text-[11px] text-subtle">{psf(q.price_per_sf)}</p>
        {delta != null && (
          <p className={`text-[10px] ${delta > 0.2 ? "text-dq" : "text-label"}`}>
            our bid {delta >= 0 ? "+" : ""}
            {Math.round(delta * 100)}% vs this
          </p>
        )}
        {q.file_url?.startsWith("http") && (
          <a href={q.file_url} target="_blank" rel="noreferrer" className="text-[10px] text-brand underline">
            files
          </a>
        )}
      </div>
    </div>
  );
}

export default function JobPricingCard({ pricing, driveFolderUrl, ourAmount }: Props) {
  const { estimates, subQuotes, loading, error } = pricing;
  const lowestSub = subQuotes.length ? Math.min(...subQuotes.map((q) => Number(q.amount))) : null;

  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-heading">Pricing & sub quotes</h3>
        {driveFolderUrl ? (
          <a
            href={driveFolderUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-label hover:text-heading"
          >
            <FolderOpen size={14} /> Job folder <ExternalLink size={11} />
          </a>
        ) : (
          <span className="text-[10px] text-subtle">No Drive folder yet (nightly sync creates it)</span>
        )}
      </div>

      {loading ? (
        <div className="h-16 flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
        </div>
      ) : error ? (
        <p className="text-xs text-dq">Couldn't load pricing: {error}</p>
      ) : (
        <>
          <p className="text-[10px] font-medium text-label uppercase tracking-wider mb-1">Our pricing runs</p>
          {estimates.length ? (
            estimates.map((e) => <EstimateLine key={e.id} e={e} />)
          ) : (
            <p className="text-xs text-subtle py-2 flex items-center gap-1.5">
              <FileText size={13} /> Not priced with the pricing skill yet.
            </p>
          )}

          <p className="text-[10px] font-medium text-label uppercase tracking-wider mt-4 mb-1">
            Sub quotes{lowestSub != null ? ` · low ${money(lowestSub)}` : ""}
          </p>
          {subQuotes.length ? (
            subQuotes.map((q) => <SubQuoteLine key={q.id} q={q} ourAmount={ourAmount} />)
          ) : (
            <p className="text-xs text-subtle py-2">No sub quotes logged.</p>
          )}
        </>
      )}
    </div>
  );
}
