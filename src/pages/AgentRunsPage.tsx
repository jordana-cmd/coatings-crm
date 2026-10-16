import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { useAgentRuns, type AgentRunRow } from "../hooks/usePricingIntel";

const AGENT_LABEL: Record<string, string> = {
  "bid-scout": "Bid Scout",
  "gmail-pdf-intake": "Nightly PDF intake + folder sync",
  "bid-results-chaser": "Bid results chaser",
  "mcfc-pricing": "Pricing skill",
};

const STATUS_STYLE: Record<string, string> = {
  SUCCEEDED: "bg-emerald-50 text-emerald-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  FAILED: "bg-red-50 text-red-700",
  RUNNING: "bg-blue-50 text-blue-700",
};

function when(s: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function duration(r: AgentRunRow): string {
  if (!r.finished_at) return "";
  const mins = Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 60000);
  return mins < 1 ? "<1 min" : `${mins} min`;
}

function RunRow({ r }: { r: AgentRunRow }) {
  const [open, setOpen] = useState(false);
  const hasDetail = r.items != null || r.errors != null;
  return (
    <div className="border-t border-card-border first:border-0 py-2.5">
      <button
        onClick={() => hasDetail && setOpen((o) => !o)}
        className="w-full flex items-start gap-2 text-left"
        aria-expanded={open}
      >
        <span className="mt-0.5 text-subtle">
          {hasDetail ? open ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <span className="inline-block w-3.5" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-heading">{AGENT_LABEL[r.agent] ?? r.agent}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[r.status] ?? "bg-gray-100 text-label"}`}>
              {r.status}
            </span>
            <span className="text-[11px] text-subtle">
              {when(r.started_at)}
              {duration(r) ? ` · ${duration(r)}` : ""}
            </span>
          </div>
          {r.summary && <p className="text-xs text-label mt-0.5 whitespace-pre-line">{r.summary}</p>}
        </div>
        {r.log_url && (
          <a
            href={r.log_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-brand"
            aria-label="Open run log"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </button>
      {open && (
        <pre className="mt-2 ml-5 max-h-72 overflow-auto rounded-lg bg-gray-50 p-3 text-[11px] text-label whitespace-pre-wrap break-words">
          {r.errors ? `Errors:\n${JSON.stringify(r.errors, null, 2)}\n\n` : ""}
          {r.items ? JSON.stringify(r.items, null, 2) : ""}
        </pre>
      )}
    </div>
  );
}

export default function AgentRunsPage() {
  const { runs, loading, error, refetch } = useAgentRuns(80);
  const [agent, setAgent] = useState("all");

  const agents = useMemo(() => Array.from(new Set(runs.map((r) => r.agent))).sort(), [runs]);
  const latest = useMemo(() => {
    const m = new Map<string, AgentRunRow>();
    for (const r of runs) if (!m.has(r.agent)) m.set(r.agent, r);
    return Array.from(m.values());
  }, [runs]);
  const shown = agent === "all" ? runs : runs.filter((r) => r.agent === agent);

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-heading">Agent runs</h1>
          <p className="text-xs text-subtle">What the scheduled agents did, newest first.</p>
        </div>
        <button
          onClick={refetch}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-label hover:text-heading"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {latest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {latest.map((r) => (
            <button
              key={r.agent}
              onClick={() => setAgent(agent === r.agent ? "all" : r.agent)}
              className={`bg-card rounded-2xl p-4 text-left border ${agent === r.agent ? "border-brand" : "border-transparent"}`}
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}
            >
              <p className="text-[10px] font-medium text-label uppercase tracking-wider">{AGENT_LABEL[r.agent] ?? r.agent}</p>
              <p className="text-sm font-semibold text-heading mt-0.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium mr-1.5 ${STATUS_STYLE[r.status] ?? ""}`}>{r.status}</span>
                {when(r.started_at)}
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-heading">History</h3>
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-heading"
            aria-label="Filter by agent"
          >
            <option value="all">All agents</option>
            {agents.map((a) => (
              <option key={a} value={a}>
                {AGENT_LABEL[a] ?? a}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <div className="h-24 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
          </div>
        ) : error ? (
          <p className="text-sm text-dq">Couldn't load runs: {error}</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-subtle py-6 text-center">
            No runs logged yet. The first ones land tonight (PDF intake) and Monday morning (Bid Scout).
          </p>
        ) : (
          shown.map((r) => <RunRow key={r.id} r={r} />)
        )}
      </div>
    </div>
  );
}
