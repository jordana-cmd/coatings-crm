import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PIPELINE_LABELS, STAGE_LABELS, type Pipeline } from "../lib/pipelines";
import {
  useForecast90d,
  useClosedWonVsGoal,
  useClosingThisMonth,
  useStaleLeaks,
  useBidOutAwaiting,
  computeCoverageGap,
  useWinRate,
  useRevenueData,
  computeRevRealization,
  useBidsThisWeek,
  type RevPeriod,
  type ClosingRow,
  type StaleRow,
  type BidOutRow,
} from "../hooks/useReports";
import { daysElapsedInYear, daysInYear } from "../config/constants";
import { useRevenueGoal } from "../hooks/useGoals";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useDashboard } from "../hooks/useDashboard";
import { Shield } from "lucide-react";

type FilterPipeline = Pipeline | "ALL";
const FILTER_OPTIONS: { value: FilterPipeline; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PUBLIC_BID", label: "Public Bid" },
  { value: "GC_CHASE", label: "GC Chase" },
  { value: "FACILITY", label: "Facility" },
];

function fmt$(n: number) { return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }

function ReportCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
      <h3 className="text-sm font-semibold text-heading mb-0.5">{title}</h3>
      {subtitle && <p className="text-[10px] text-subtle mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}

// ── Report 1: Forecast ──

function ForecastChart({ filter }: { filter: FilterPipeline }) {
  const { data, loading } = useForecast90d();
  if (loading) return <div className="h-48 flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" /></div>;

  const filtered = filter === "ALL" ? data : data.filter((d) => d.pipeline === filter);

  // Aggregate by month
  const byMonth: Record<string, { month: string; committed: number; upside: number }> = {};
  for (const r of filtered) {
    const m = new Date(r.close_month).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    if (!byMonth[m]) byMonth[m] = { month: m, committed: 0, upside: 0 };
    byMonth[m].committed += r.committed_weighted;
    byMonth[m].upside += r.upside_weighted;
  }
  const chartData = Object.values(byMonth);

  if (chartData.length === 0) {
    return <p className="text-sm text-subtle text-center py-8">No opps with expected close dates in the next 90 days</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} barGap={4}>
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v) => fmt$(Number(v))} />
        <Bar dataKey="committed" name="Committed" fill="#db0000" radius={[4, 4, 0, 0]} />
        <Bar dataKey="upside" name="Upside" fill="#db000033" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Report 2: Closed-Won vs Goal ──

function ClosedWonGoalChart({ filter, goalTarget, goalYear }: { filter: FilterPipeline; goalTarget: number | null; goalYear: number }) {
  const { data, loading } = useClosedWonVsGoal();
  if (loading) return <div className="h-32 flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" /></div>;

  const filtered = filter === "ALL" ? data : data.filter((d) => d.pipeline === filter);
  const totalWon = filtered.reduce((s, r) => s + r.closed_won_ytd, 0);
  const goal = goalTarget ?? 0;
  const pct = goal > 0 ? Math.min(totalWon / goal, 1) : 0;

  if (goalTarget == null) {
    return <p className="text-sm text-subtle text-center py-6">Set a revenue goal for {goalYear} to track pace</p>;
  }

  const elapsed = daysElapsedInYear(goalYear);
  const totalDays = daysInYear(goalYear);
  const runRate = elapsed > 0 ? (totalWon / elapsed) * totalDays : 0;
  const onPace = runRate >= goal;

  return (
    <div>
      {/* Per-pipeline breakdown */}
      {data.length > 0 && filter === "ALL" && (
        <div className="flex flex-wrap gap-3 mb-3">
          {data.map((r) => (
            <span key={r.pipeline} className="text-xs text-label">
              {PIPELINE_LABELS[r.pipeline]}: <span className="font-semibold text-heading">{fmt$(r.closed_won_ytd)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div className="absolute inset-y-0 left-0 bg-brand rounded-full transition-all"
          style={{ width: `${pct * 100}%` }} />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-heading">
          {fmt$(totalWon)} / {fmt$(goal)}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-label">{(pct * 100).toFixed(1)}% of goal</span>
        <span className={`font-medium ${onPace ? "text-gate-met" : "text-brand"}`}>
          Projected: {fmt$(Math.round(runRate))} {onPace ? "— on pace" : "— behind pace"}
        </span>
      </div>
    </div>
  );
}

// ── Card: Win Rate per Pipeline ──

function WinRateCard() {
  const { data, loading } = useWinRate();
  if (loading) return <ReportCard title="Win Rate by Pipeline" subtitle="WON ÷ (WON + LOST) — decided opps only"><div className="h-20 flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" /></div></ReportCard>;

  return (
    <ReportCard title="Win Rate by Pipeline" subtitle="WON ÷ (WON + LOST) — decided opps only">
      <div className="space-y-3">
        {data.map((r) => (
          <div key={r.pipeline} className="flex items-center justify-between">
            <span className="text-xs text-label">{PIPELINE_LABELS[r.pipeline]}</span>
            <div className="flex items-center gap-2">
              {r.rate != null ? (
                <>
                  <span className="text-lg font-semibold text-heading">{(r.rate * 100).toFixed(0)}%</span>
                  <span className="text-[10px] text-subtle">{r.won} of {r.decided}</span>
                </>
              ) : (
                <span className="text-sm text-subtle">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </ReportCard>
  );
}

// ── Card: Revenue Realization (Booked vs Delivered) ──

const REV_PERIODS: { value: RevPeriod; label: string; emptyLabel: string }[] = [
  { value: "MONTH", label: "Month", emptyLabel: "this month" },
  { value: "QUARTER", label: "Quarter", emptyLabel: "this quarter" },
  { value: "YEAR", label: "Year", emptyLabel: "this year" },
  { value: "ALL", label: "All-time", emptyLabel: "yet" },
];

function RevenueRealizationCard() {
  const { rows, loading } = useRevenueData();
  const [period, setPeriod] = useState<RevPeriod>("YEAR");

  const r = computeRevRealization(rows, period);
  const periodLabel = REV_PERIODS.find((p) => p.value === period)!;
  const hasWon = r.periodWonCount > 0;
  const hasInstalled = r.periodInstalledCount > 0;
  const hasAnyData = hasWon || hasInstalled || r.backlog > 0;
  const deliveredPct = r.periodWon > 0 ? r.periodInstalled / r.periodWon : 0;

  const spinner = <div className="h-24 flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" /></div>;

  return (
    <ReportCard title="Revenue Realization" subtitle="Booked vs delivered — what's been won and what's been installed">
      {/* Period toggle */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 mb-4">
        {REV_PERIODS.map((p) => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`flex-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors
              ${period === p.value ? "bg-brand text-white" : "text-label hover:text-heading"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? spinner : !hasAnyData ? (
        <p className="text-sm text-subtle text-center py-6">No bids won {periodLabel.emptyLabel}</p>
      ) : (
        <div>
          {/* Won & Installed for the period */}
          <div className="grid grid-cols-2 gap-4 text-center mb-3">
            <div>
              <p className="text-[10px] text-label uppercase tracking-wider">Booked{period !== "ALL" ? ` ${periodLabel.label}` : ""}</p>
              <p className="text-xl font-semibold text-heading">{hasWon ? fmt$(r.periodWon) : "—"}</p>
              {hasWon && <p className="text-[10px] text-subtle">{r.periodWonCount} job{r.periodWonCount !== 1 ? "s" : ""} won</p>}
            </div>
            <div>
              <p className="text-[10px] text-label uppercase tracking-wider">Delivered{period !== "ALL" ? ` ${periodLabel.label}` : ""}</p>
              <p className="text-xl font-semibold text-gate-met">{hasInstalled ? fmt$(r.periodInstalled) : "—"}</p>
              {hasInstalled && <p className="text-[10px] text-subtle">{r.periodInstalledCount} job{r.periodInstalledCount !== 1 ? "s" : ""} installed</p>}
            </div>
          </div>

          {/* Progress bar (period-scoped) */}
          {hasWon && (
            <div className="mb-4">
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-gate-met rounded-full transition-all" style={{ width: `${Math.min(deliveredPct * 100, 100)}%` }} />
              </div>
              <p className="text-[10px] text-subtle mt-1 text-right">{(deliveredPct * 100).toFixed(0)}% delivered</p>
            </div>
          )}

          {/* All-time backlog */}
          {r.backlog > 0 && (
            <div className="rounded-xl bg-gray-50 px-4 py-3 text-center">
              <p className="text-[10px] text-label uppercase tracking-wider">Still to install</p>
              <p className="text-lg font-semibold text-heading">{fmt$(r.backlog)}</p>
              <p className="text-[10px] text-subtle">secured revenue not yet delivered</p>
            </div>
          )}
        </div>
      )}
    </ReportCard>
  );
}

// ── Card: Average Job Size ──

function AvgJobSizeCard() {
  const { rows, loading } = useRevenueData();

  const allTimeWon = rows.reduce((s, r) => s + r.amount, 0);
  const wonCount = rows.length;
  const avg = wonCount > 0 ? allTimeWon / wonCount : null;

  if (loading) return <ReportCard title="Average Job Size" subtitle="Mean $ per won job"><div className="h-16 flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" /></div></ReportCard>;

  return (
    <ReportCard title="Average Job Size" subtitle="Mean $ per won job">
      <div className="text-center py-2">
        {avg != null ? (
          <>
            <p className="text-2xl font-semibold text-heading">{fmt$(Math.round(avg))}</p>
            <p className="text-xs text-subtle mt-1">across {wonCount} won job{wonCount !== 1 ? "s" : ""}</p>
          </>
        ) : (
          <p className="text-sm text-subtle">—</p>
        )}
      </div>
    </ReportCard>
  );
}

// ── Card: Bids This Week ──

function BidsThisWeekCard() {
  const { data, loading } = useBidsThisWeek();
  if (loading) return <ReportCard title="Bids This Week" subtitle="Submitted vs weekly pace target"><div className="h-16 flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" /></div></ReportCard>;

  const { submitted, target } = data;
  const hasTarget = target != null && target > 0;
  const weeklyTarget = hasTarget ? Math.ceil(target!) : 0;
  const onPace = hasTarget && submitted >= weeklyTarget;

  return (
    <ReportCard title="Bids This Week" subtitle="Submitted vs weekly pace target">
      <div className="text-center py-2">
        {hasTarget ? (
          <>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className={`text-2xl font-semibold ${onPace ? "text-gate-met" : "text-brand"}`}>{submitted}</span>
              <span className="text-sm text-subtle">/</span>
              <span className="text-lg font-medium text-heading">{weeklyTarget}</span>
            </div>
            <p className={`text-xs font-medium mt-1 ${onPace ? "text-gate-met" : "text-brand"}`}>
              {onPace ? "On pace" : "Behind pace"} — {submitted} submitted, {weeklyTarget} needed
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold text-heading">{submitted}</p>
            <p className="text-xs text-subtle mt-1">submitted this week — set a bids goal to see target</p>
          </>
        )}
      </div>
    </ReportCard>
  );
}

// ── Sortable table helper ──

type SortDir = "asc" | "desc";

function SortTh({ label, active, dir, onClick, align }: {
  label: string; active: boolean; dir: SortDir; onClick: () => void; align?: "right";
}) {
  return (
    <th className={`px-4 py-3 font-medium cursor-pointer select-none hover:text-heading text-[10px] text-label uppercase tracking-wider ${align === "right" ? "text-right" : "text-left"}`}
      onClick={onClick}>
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active && <span className="text-brand text-[9px]">{dir === "asc" ? "\u25B2" : "\u25BC"}</span>}
      </span>
    </th>
  );
}

function sortRows<T>(rows: T[], key: keyof T, dir: SortDir): T[] {
  return [...rows].sort((a, b) => {
    const av = a[key]; const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    let cmp: number;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return dir === "asc" ? cmp : -cmp;
  });
}

function relDays(iso: string | null): string {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

// ── Report 5: Closing This Month ──

function ClosingThisMonthTable({ filter }: { filter: FilterPipeline }) {
  const navigate = useNavigate();
  const { data, loading } = useClosingThisMonth();
  const [sortKey, setSortKey] = useState<keyof ClosingRow>("weighted_amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = filter === "ALL" ? data : data.filter((d) => d.pipeline === filter);
  const sorted = useMemo(() => sortRows(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  const toggle = (k: keyof ClosingRow) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" || k === "company_name" ? "asc" : "desc"); }
  };

  return (
    <ReportCard title="Closing This Month" subtitle="Work from the top.">
      {loading ? <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" /></div>
      : sorted.length === 0 ? <p className="text-sm text-subtle text-center py-6">No opps closing within 30 days</p>
      : <>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-card-border">
              <SortTh label="Name" active={sortKey==="name"} dir={sortDir} onClick={() => toggle("name")} />
              <SortTh label="Company" active={sortKey==="company_name"} dir={sortDir} onClick={() => toggle("company_name")} />
              <SortTh label="Amount" active={sortKey==="amount"} dir={sortDir} onClick={() => toggle("amount")} align="right" />
              <SortTh label="Weighted" active={sortKey==="weighted_amount"} dir={sortDir} onClick={() => toggle("weighted_amount")} align="right" />
              <SortTh label="Stage" active={sortKey==="stage"} dir={sortDir} onClick={() => toggle("stage")} />
              <SortTh label="Next Step" active={sortKey==="next_step"} dir={sortDir} onClick={() => toggle("next_step")} />
            </tr></thead>
            <tbody className="divide-y divide-card-border">
              {sorted.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/opp/${r.id}`)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-medium nav-link">{r.name}</td>
                  <td className="px-4 py-3 text-label">{r.company_name}</td>
                  <td className="px-4 py-3 text-right text-heading">{r.amount != null ? fmt$(r.amount) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-heading">{r.weighted_amount != null ? fmt$(r.weighted_amount) : "—"}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-heading">{STAGE_LABELS[r.stage] ?? r.stage}</span></td>
                  <td className="px-4 py-3 text-label text-xs truncate max-w-[150px]">{r.next_step ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-2">
          {sorted.map((r) => (
            <button key={r.id} onClick={() => navigate(`/opp/${r.id}`)} className="w-full text-left rounded-lg border border-card-border p-3 active:bg-gray-50">
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-heading truncate">{r.name}</span><span className="text-sm font-semibold text-heading">{r.weighted_amount != null ? fmt$(r.weighted_amount) : "—"}</span></div>
              <p className="text-xs text-label mt-0.5">{r.company_name} · {STAGE_LABELS[r.stage] ?? r.stage}</p>
            </button>
          ))}
        </div>
      </>}
    </ReportCard>
  );
}

// ── Report 6: Stale / Leaks ──

function StaleLeaksTable({ filter }: { filter: FilterPipeline }) {
  const navigate = useNavigate();
  const { data, loading } = useStaleLeaks();
  const [sortKey, setSortKey] = useState<keyof StaleRow>("amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = filter === "ALL" ? data : data.filter((d) => d.pipeline === filter);
  const sorted = useMemo(() => sortRows(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  const toggle = (k: keyof StaleRow) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" || k === "company_name" ? "asc" : "desc"); }
  };

  return (
    <ReportCard title={`Stale / No-Next-Step${sorted.length > 0 ? ` — ${sorted.length} leak${sorted.length !== 1 ? "s" : ""}` : ""}`}
      subtitle="Deals leaking from neglect — clear weekly.">
      {loading ? <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" /></div>
      : sorted.length === 0 ? <p className="text-sm text-gate-met text-center py-6">No stale deals — pipeline is healthy</p>
      : <>
        {sorted.length > 0 && (
          <div className="mb-3">
            <span className="rounded-full bg-pending-light text-pending px-2.5 py-0.5 text-[10px] font-semibold">
              {sorted.length} leak{sorted.length !== 1 ? "s" : ""} — clear to zero
            </span>
          </div>
        )}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-card-border">
              <SortTh label="Name" active={sortKey==="name"} dir={sortDir} onClick={() => toggle("name")} />
              <SortTh label="Company" active={sortKey==="company_name"} dir={sortDir} onClick={() => toggle("company_name")} />
              <SortTh label="Amount" active={sortKey==="amount"} dir={sortDir} onClick={() => toggle("amount")} align="right" />
              <SortTh label="Stage" active={sortKey==="stage"} dir={sortDir} onClick={() => toggle("stage")} />
              <SortTh label="Last Activity" active={sortKey==="last_activity_at"} dir={sortDir} onClick={() => toggle("last_activity_at")} />
              <SortTh label="Next Step Date" active={sortKey==="next_step_date"} dir={sortDir} onClick={() => toggle("next_step_date")} />
            </tr></thead>
            <tbody className="divide-y divide-card-border">
              {sorted.map((r) => {
                const overdue = r.next_step_date && r.next_step_date < new Date().toISOString().slice(0, 10);
                const missing = !r.next_step_date;
                return (
                  <tr key={r.id} onClick={() => navigate(`/opp/${r.id}`)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 font-medium nav-link">{r.name}</td>
                    <td className="px-4 py-3 text-label">{r.company_name}</td>
                    <td className="px-4 py-3 text-right text-heading">{r.amount != null ? fmt$(r.amount) : "—"}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-heading">{STAGE_LABELS[r.stage] ?? r.stage}</span></td>
                    <td className="px-4 py-3 text-label text-xs">{relDays(r.last_activity_at)}</td>
                    <td className={`px-4 py-3 text-xs font-medium ${overdue ? "text-brand" : missing ? "text-pending" : "text-label"}`}>
                      {missing ? "Missing" : overdue ? `Overdue (${r.next_step_date})` : r.next_step_date}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-2">
          {sorted.map((r) => (
            <button key={r.id} onClick={() => navigate(`/opp/${r.id}`)} className="w-full text-left rounded-lg border border-pending/30 p-3 active:bg-gray-50">
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-heading truncate">{r.name}</span><span className="text-sm font-semibold text-heading">{r.amount != null ? fmt$(r.amount) : "—"}</span></div>
              <p className="text-xs text-label mt-0.5">{r.company_name} · {relDays(r.last_activity_at)} · Next: {r.next_step_date ?? "missing"}</p>
            </button>
          ))}
        </div>
      </>}
    </ReportCard>
  );
}

// ── Report 7: Bids Out Awaiting ──

function BidsOutTable({ filter }: { filter: FilterPipeline }) {
  const navigate = useNavigate();
  const { data, loading } = useBidOutAwaiting();
  const [sortKey, setSortKey] = useState<keyof BidOutRow>("days_until");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = filter === "ALL" ? data : data.filter((d) => d.pipeline === filter);
  const sorted = useMemo(() => sortRows(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  const toggle = (k: keyof BidOutRow) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "project_name" || k === "company_name" ? "asc" : "desc"); }
  };

  return (
    <ReportCard title="Bid Out, Awaiting Decision" subtitle="Awaiting award — follow up before the date.">
      {loading ? <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" /></div>
      : sorted.length === 0 ? <p className="text-sm text-subtle text-center py-6">No bids out awaiting decision</p>
      : <>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-card-border">
              <SortTh label="Project" active={sortKey==="project_name"} dir={sortDir} onClick={() => toggle("project_name")} />
              <SortTh label="Company" active={sortKey==="company_name"} dir={sortDir} onClick={() => toggle("company_name")} />
              <SortTh label="Our Number" active={sortKey==="our_number"} dir={sortDir} onClick={() => toggle("our_number")} align="right" />
              <SortTh label="Due/Decision" active={sortKey==="decision_date"} dir={sortDir} onClick={() => toggle("decision_date")} />
              <SortTh label="Days Until" active={sortKey==="days_until"} dir={sortDir} onClick={() => toggle("days_until")} />
              {filter === "ALL" && <th className="px-4 py-3 text-[10px] text-label uppercase tracking-wider font-medium">GC</th>}
            </tr></thead>
            <tbody className="divide-y divide-card-border">
              {sorted.map((r) => {
                const overdue = r.days_until != null && r.days_until < 0;
                const urgent = r.days_until != null && r.days_until <= 7 && r.days_until >= 0;
                return (
                  <tr key={`${r.opp_id}-${r.gc_name ?? ""}`} onClick={() => navigate(`/opp/${r.opp_id}`)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 font-medium nav-link">{r.project_name}</td>
                    <td className="px-4 py-3 text-label">{r.company_name}</td>
                    <td className="px-4 py-3 text-right text-heading">{r.our_number != null ? fmt$(r.our_number) : "—"}</td>
                    <td className="px-4 py-3 text-label text-xs">{r.decision_date ? new Date(r.decision_date).toLocaleDateString() : "—"}</td>
                    <td className={`px-4 py-3 text-xs font-semibold ${overdue ? "text-brand" : urgent ? "text-pending" : "text-heading"}`}>
                      {r.days_until != null ? (overdue ? `${Math.abs(r.days_until)}d overdue` : `${r.days_until}d`) : "—"}
                    </td>
                    {filter === "ALL" && <td className="px-4 py-3 text-label text-xs">{r.gc_name ?? "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-2">
          {sorted.map((r) => (
            <button key={`${r.opp_id}-${r.gc_name ?? ""}`} onClick={() => navigate(`/opp/${r.opp_id}`)} className="w-full text-left rounded-lg border border-card-border p-3 active:bg-gray-50">
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-heading truncate">{r.project_name}</span><span className="text-sm font-semibold text-heading">{r.our_number != null ? fmt$(r.our_number) : "—"}</span></div>
              <p className="text-xs text-label mt-0.5">{r.company_name} · {r.days_until != null ? `${r.days_until}d` : "—"}{r.gc_name ? ` · GC: ${r.gc_name}` : ""}</p>
            </button>
          ))}
        </div>
      </>}
    </ReportCard>
  );
}

// ── % Pipeline Bonded (moved from Dashboard — periodic metric) ──

function BondExposureCard() {
  const { data, loading } = useDashboard();
  if (loading || !data) return <ReportCard title="% Pipeline Bonded" subtitle="Bond exposure on outstanding bids"><div className="h-16 flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" /></div></ReportCard>;

  const { bondExposure } = data;
  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const pct = bondExposure.totalDollars > 0 ? (bondExposure.pct * 100).toFixed(1) + "%" : "—";

  return (
    <ReportCard title="% Pipeline Bonded" subtitle="Bond exposure on outstanding bids">
      <div className="flex items-center gap-3 py-2">
        <Shield size={20} className="text-subtle shrink-0" />
        <div>
          <p className="text-xl font-semibold text-heading">{pct}</p>
          {bondExposure.totalDollars > 0 ? (
            <p className="text-[10px] text-subtle">{fmt(bondExposure.bondedDollars)} bonded of {fmt(bondExposure.totalDollars)}</p>
          ) : (
            <p className="text-[10px] text-subtle">No outstanding bids</p>
          )}
        </div>
      </div>
    </ReportCard>
  );
}

// ── Report 8: Coverage Gap ──

function CoverageGapCard({ filter, goalTarget }: { filter: FilterPipeline; goalTarget: number | null }) {
  const { data: wonData, loading: wonLoading } = useClosedWonVsGoal();
  const { data: forecastData, loading: forecastLoading } = useForecast90d();

  if (wonLoading || forecastLoading) return null;
  if (goalTarget == null) return null;

  const wonFiltered = filter === "ALL" ? wonData : wonData.filter((d) => d.pipeline === filter);
  const closedWonYtd = wonFiltered.reduce((s, r) => s + r.closed_won_ytd, 0);

  // Weighted pipeline = all open opps' weighted amounts (approximate from forecast + extend)
  // For a more complete picture, use all forecast data as proxy
  const fFiltered = filter === "ALL" ? forecastData : forecastData.filter((d) => d.pipeline === filter);
  const weightedPipeline = fFiltered.reduce((s, r) => s + r.total_weighted, 0);

  const { remaining, coverage, verdict } = computeCoverageGap(weightedPipeline, closedWonYtd, goalTarget);

  const verdictColor = verdict === "green" ? "text-gate-met" : verdict === "yellow" ? "text-pending" : "text-brand";
  const verdictBg = verdict === "green" ? "bg-gate-met-light" : verdict === "yellow" ? "bg-pending-light" : "bg-brand-light";
  const verdictText = coverage >= 3
    ? "Closing problem — pipeline is deep enough. Work reports below."
    : "Sourcing problem — pipeline too thin to hit goal. Prospect now.";

  return (
    <ReportCard title="Coverage Gap" subtitle="Do we have enough pipeline to hit the goal?">
      <div className={`rounded-xl p-4 ${verdictBg} mb-3`}>
        <p className={`text-sm font-semibold ${verdictColor}`}>{verdictText}</p>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-[10px] text-label uppercase tracking-wider">Remaining</p>
          <p className="text-lg font-semibold text-heading">{fmt$(Math.max(remaining, 0))}</p>
        </div>
        <div>
          <p className="text-[10px] text-label uppercase tracking-wider">Weighted Pipeline</p>
          <p className="text-lg font-semibold text-heading">{fmt$(weightedPipeline)}</p>
        </div>
        <div>
          <p className="text-[10px] text-label uppercase tracking-wider">Coverage</p>
          <p className={`text-lg font-semibold ${verdictColor}`}>{coverage.toFixed(1)}x</p>
        </div>
      </div>
    </ReportCard>
  );
}

// ── Main ──

export default function ReportsPage() {
  const [filter, setFilter] = useState<FilterPipeline>("ALL");
  const { target: goalTarget, year: goalYear } = useRevenueGoal();

  return (
    <div className="space-y-6 pb-16 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold text-heading">Reports</h1>
        <div className="flex bg-gray-200 rounded-lg p-0.5">
          {FILTER_OPTIONS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                ${filter === f.value ? "bg-brand text-white" : "text-label hover:text-heading"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Owner View */}
      <div>
        <h2 className="text-xs font-semibold text-label uppercase tracking-wider mb-3">Owner View</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ReportCard title="Closed-Won vs Goal" subtitle={goalTarget != null ? `Are we on pace for ${fmt$(goalTarget)} in ${goalYear}?` : `Set a ${goalYear} revenue goal`}>
            <ClosedWonGoalChart filter={filter} goalTarget={goalTarget} goalYear={goalYear} />
          </ReportCard>

          <ReportCard title="Weighted Forecast — Next 90 Days" subtitle="Can we make payroll without overpromising capacity?">
            <ForecastChart filter={filter} />
          </ReportCard>

          <WinRateCard />
          <RevenueRealizationCard />
          <AvgJobSizeCard />
          <BidsThisWeekCard />
          <BondExposureCard />
        </div>
      </div>

      {/* My Worklist */}
      <div>
        <h2 className="text-xs font-semibold text-label uppercase tracking-wider mb-3">My Worklist</h2>
        <div className="space-y-4">
          <CoverageGapCard filter={filter} goalTarget={goalTarget} />
          <ClosingThisMonthTable filter={filter} />
          <StaleLeaksTable filter={filter} />
          <BidsOutTable filter={filter} />
        </div>
      </div>
    </div>
  );
}
