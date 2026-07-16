import { useState } from "react";
import { ExternalLink, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import type { FederalRow } from "../../lib/gates/types";
import type { useFederalDetails } from "../../hooks/useFederalDetails";

// ── small helpers ──

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmt$(n: number | null): string {
  return n != null ? "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—";
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-gray-100 text-label",
  PROCESSING: "bg-pending-light text-pending",
  COMPLETE: "bg-gate-met-light text-gate-met",
  FAILED: "bg-dq-bg text-dq",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status] ?? "bg-gray-100 text-label"}`}>
      {status}
    </span>
  );
}

const REC_STYLES: Record<string, string> = {
  BID: "bg-gate-met text-white",
  WATCH: "bg-pending text-white",
  PASS: "bg-dq text-white",
};

function KvPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-label uppercase tracking-wider">{label}</p>
      <p className="text-sm text-heading mt-0.5">{value}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-label uppercase tracking-wider">{label}</span>
        <span className="text-xs font-semibold text-heading">{value != null ? Math.round(value) : "—"}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} />
      </div>
    </div>
  );
}

// Local copies of OppDetail's field inputs (kept local to avoid a page ↔ component import cycle)
function NumberInput({ label, value, placeholder, onSave, isSaving }: {
  label: string; value: number | null; placeholder?: string; onSave: (v: number | null) => void; isSaving: boolean;
}) {
  const [local, setLocal] = useState(value != null ? String(value) : "");
  const numVal = local === "" ? null : parseFloat(local);
  const dirty = numVal !== value;
  return (
    <div className="py-2.5">
      <label className="block text-xs text-label mb-1">{label}</label>
      <div className="flex gap-2">
        <input type="number" step="0.01" value={local} onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { if (dirty) onSave(numVal); }} placeholder={placeholder} disabled={isSaving}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading
                     focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:opacity-50" />
        {dirty && (
          <button type="button" onClick={() => onSave(numVal)} disabled={isSaving}
            className="rounded-lg bg-brand text-white px-3 py-2.5 text-xs font-medium
                       active:bg-brand-hover disabled:opacity-50 shrink-0">
            {isSaving ? "..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

function TextInput({ label, value, placeholder, onSave, isSaving, type = "text" }: {
  label: string; value: string; placeholder?: string; onSave: (v: string) => void; isSaving: boolean; type?: string;
}) {
  const [local, setLocal] = useState(value);
  const dirty = local !== value;
  return (
    <div className="py-2.5">
      <label className="block text-xs text-label mb-1">{label}</label>
      <div className="flex gap-2">
        <input type={type} value={local} onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { if (dirty) onSave(local); }} placeholder={placeholder} disabled={isSaving}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading
                     focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:opacity-50" />
        {dirty && (
          <button type="button" onClick={() => onSave(local)} disabled={isSaving}
            className="rounded-lg bg-brand text-white px-3 py-2.5 text-xs font-medium
                       active:bg-brand-hover disabled:opacity-50 shrink-0">
            {isSaving ? "..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── panel ──

interface Props {
  fed: FederalRow;
  federal: ReturnType<typeof useFederalDetails>;
}

export default function FederalPanel({ fed, federal }: Props) {
  const { updateFederalField, runExtraction, runScoring, saving, extracting, scoring, error } = federal;
  const [descExpanded, setDescExpanded] = useState(false);
  const isSaving = (f: string) => saving === f;

  const extractionFailed = fed.extraction_status === "FAILED";
  const extractionDone = fed.extraction_status === "COMPLETE";
  const scoringDone = fed.scoring_status === "COMPLETE";
  const extractionError =
    extractionFailed && fed.extraction_json && typeof fed.extraction_json === "object"
      ? String((fed.extraction_json as Record<string, unknown>).error ?? "")
      : null;
  const scopeSummary =
    fed.extraction_json && typeof fed.extraction_json === "object"
      ? (fed.extraction_json as Record<string, unknown>).scope_summary
      : null;

  return (
    <>
      {/* Solicitation */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-label uppercase tracking-wide">SAM.gov Solicitation</h3>
          {fed.sam_url && (
            <a href={fed.sam_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand font-medium">
              View on SAM.gov <ExternalLink size={12} />
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <KvPair label="Solicitation #" value={fed.solicitation_number ?? "—"} />
          <KvPair label="NAICS" value={fed.naics_code} />
          <KvPair label="Set-Aside" value={fed.set_aside_type ?? "None"} />
          <KvPair label="Posted" value={fmtDate(fed.posted_date)} />
          <KvPair label="Response Deadline" value={fmtDate(fed.response_deadline)} />
          <KvPair label="Magnitude" value={fed.magnitude ?? "—"} />
          <KvPair label="Place of Performance"
            value={fed.pop_city && fed.pop_state ? `${fed.pop_city}, ${fed.pop_state}` : fed.pop_state ?? fed.pop_city ?? "—"} />
          <div className="col-span-2 sm:col-span-3">
            <p className="text-[10px] text-label uppercase tracking-wider">Agency</p>
            <p className="text-sm text-heading mt-0.5">{fed.office ?? fed.department ?? "—"}</p>
          </div>
          {fed.contracting_officer && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-[10px] text-label uppercase tracking-wider">Contracting Officer</p>
              <p className="text-sm text-heading mt-0.5">
                {fed.contracting_officer}
                {fed.co_email && <a href={`mailto:${fed.co_email}`} className="text-brand ml-2">{fed.co_email}</a>}
                {fed.co_phone && <span className="text-label ml-2">{fed.co_phone}</span>}
              </p>
            </div>
          )}
        </div>
        {fed.description_text && (
          <div className="mt-3 pt-3 border-t border-card-border">
            <p className="text-xs text-label whitespace-pre-wrap">
              {descExpanded || fed.description_text.length <= 300
                ? fed.description_text
                : fed.description_text.slice(0, 300) + "…"}
            </p>
            {fed.description_text.length > 300 && (
              <button onClick={() => setDescExpanded(!descExpanded)}
                className="flex items-center gap-0.5 text-xs text-brand font-medium mt-1">
                {descExpanded ? <>Show less <ChevronUp size={12} /></> : <>Show full description <ChevronDown size={12} /></>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* AI: Extraction */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-label uppercase tracking-wide">Document Extraction</h3>
            <StatusBadge status={fed.extraction_status} />
          </div>
          <button onClick={runExtraction} disabled={extracting || scoring || !fed.description_text}
            title={!fed.description_text ? "No description text to extract from" : undefined}
            className="flex items-center gap-1.5 rounded-lg bg-brand text-white px-3 py-1.5 text-xs font-medium
                       active:bg-brand-hover disabled:opacity-50">
            <Sparkles size={12} />
            {extracting ? "Extracting…" : extractionDone ? "Re-run Extraction" : "Run Extraction"}
          </button>
        </div>

        {extracting && (
          <p className="text-xs text-label mb-3">Claude is reading the solicitation — this takes a minute or two…</p>
        )}
        {extractionError && (
          <p className="text-xs text-dq bg-dq-bg rounded-lg px-3 py-2 mb-3">{extractionError}</p>
        )}

        {extractionDone ? (
          <>
            {typeof scopeSummary === "string" && scopeSummary && (
              <p className="text-sm text-heading bg-gray-50 rounded-lg px-3 py-2 mb-3">{scopeSummary}</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <KvPair label="Square Footage" value={fed.square_footage != null ? fed.square_footage.toLocaleString() + " SF" : "Not stated"} />
              <KvPair label="System Spec" value={fed.system_spec ?? "Not stated"} />
              <KvPair label="Surface Prep" value={fed.surface_prep ?? "Not stated"} />
              <KvPair label="Bond" value={fed.bond_required ? `Required${fed.bond_amount ? ` (${fmt$(fed.bond_amount)})` : ""}` : "Not required"} />
              <KvPair label="Site Visit" value={fed.site_visit_date ? `${fmtDate(fed.site_visit_date)}${fed.site_visit_mandatory ? " (mandatory)" : ""}` : "None stated"} />
              <KvPair label="Wage Determination" value={fed.wage_determination ?? "None cited"} />
            </div>
          </>
        ) : !extracting && !extractionFailed ? (
          <p className="text-sm text-subtle">
            Run extraction to pull square footage, system spec, bond and site-visit details out of the solicitation text.
            Required to advance past Intake.
          </p>
        ) : null}
      </div>

      {/* AI: Scoring */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-label uppercase tracking-wide">Bid / No-Bid Score</h3>
            <StatusBadge status={fed.scoring_status} />
          </div>
          <button onClick={runScoring} disabled={scoring || extracting || !extractionDone}
            title={!extractionDone ? "Run extraction first" : undefined}
            className="flex items-center gap-1.5 rounded-lg bg-brand text-white px-3 py-1.5 text-xs font-medium
                       active:bg-brand-hover disabled:opacity-50">
            <Sparkles size={12} />
            {scoring ? "Scoring…" : scoringDone ? "Re-run Scoring" : "Run Scoring"}
          </button>
        </div>

        {scoring && <p className="text-xs text-label mb-3">Claude is scoring this opportunity against the company profile…</p>}

        {scoringDone && fed.score_recommendation ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className={`rounded-lg px-4 py-1.5 text-sm font-bold ${REC_STYLES[fed.score_recommendation] ?? "bg-gray-100 text-label"}`}>
                {fed.score_recommendation}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-4">
              <ScoreBar label="Scope Fit" value={fed.scope_fit} />
              <ScoreBar label="Magnitude Fit" value={fed.magnitude_fit} />
              <ScoreBar label="Geography" value={fed.geography_fit} />
              <ScoreBar label="Set-Aside Adv." value={fed.set_aside_advantage} />
              <ScoreBar label="Agency Adv." value={fed.agency_advantage} />
            </div>
            {Array.isArray(fed.score_reasons) && fed.score_reasons.length > 0 && (
              <ul className="space-y-1">
                {(fed.score_reasons as string[]).map((r, i) => (
                  <li key={i} className="text-xs text-label flex gap-2">
                    <span className="text-subtle shrink-0">•</span>{String(r)}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : !scoring ? (
          <p className="text-sm text-subtle">
            {extractionDone
              ? "Run scoring for a BID / WATCH / PASS recommendation. Required to advance past Extraction."
              : "Complete extraction first, then score the opportunity."}
          </p>
        ) : null}
      </div>

      {/* Estimate & submission */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <h3 className="text-xs font-semibold text-label uppercase tracking-wide mb-2">Federal Estimate</h3>
        <div className="divide-y divide-card-border">
          <NumberInput label="Rate ($/SF)" value={fed.estimate_sqft_rate} placeholder="e.g. 8.50"
            onSave={(v) => updateFederalField("estimate_sqft_rate", v)} isSaving={isSaving("estimate_sqft_rate")} />
          <NumberInput label="Mobilization ($)" value={fed.estimate_mobilization} placeholder="e.g. 15000"
            onSave={(v) => updateFederalField("estimate_mobilization", v)} isSaving={isSaving("estimate_mobilization")} />
          <NumberInput label="Estimate Total ($)" value={fed.estimate_total} placeholder="Total bid estimate"
            onSave={(v) => updateFederalField("estimate_total", v)} isSaving={isSaving("estimate_total")} />
          <TextInput label="Bid Package URL" value={fed.bid_package_url ?? ""} placeholder="https://storage/bid-package.pdf"
            onSave={(v) => updateFederalField("bid_package_url", v || null)} isSaving={isSaving("bid_package_url")} type="url" />
        </div>
      </div>

      {error && (
        <div className="bg-dq-bg border border-dq-border rounded-xl p-3 text-sm text-dq text-center">{error}</div>
      )}
    </>
  );
}
