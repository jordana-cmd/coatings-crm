import { useState } from "react";
import { PIPELINE_LABELS, type Pipeline } from "../lib/pipelines";
import {
  useForecast90d,
  useClosedWonVsGoal,
  useCustomerConcentration,
} from "../hooks/useReports";
import { ANNUAL_GOAL_CLOSED_WON, GOAL_YEAR, daysElapsedInYear, daysInYear } from "../config/constants";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";

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

function ClosedWonGoalChart({ filter }: { filter: FilterPipeline }) {
  const { data, loading } = useClosedWonVsGoal();
  if (loading) return <div className="h-32 flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" /></div>;

  const filtered = filter === "ALL" ? data : data.filter((d) => d.pipeline === filter);
  const totalWon = filtered.reduce((s, r) => s + r.closed_won_ytd, 0);
  const goal = ANNUAL_GOAL_CLOSED_WON;
  const pct = goal > 0 ? Math.min(totalWon / goal, 1) : 0;

  const elapsed = daysElapsedInYear(GOAL_YEAR);
  const totalDays = daysInYear(GOAL_YEAR);
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

// ── Report 4: Customer Concentration ──

const COLORS = ["#db0000", "#ef4444", "#f87171", "#fca5a5", "#fecaca", "#fee2e2", "#fef2f2", "#6B7280", "#9CA3AF", "#D1D5DB"];

function ConcentrationChart({ filter }: { filter: FilterPipeline }) {
  const { data, loading } = useCustomerConcentration();
  if (loading) return <div className="h-48 flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" /></div>;

  const filtered = filter === "ALL" ? data : data.filter((d) => d.pipeline === filter);

  // Aggregate by company
  const byCompany: Record<string, { name: string; dollars: number }> = {};
  for (const r of filtered) {
    if (!byCompany[r.company_id]) byCompany[r.company_id] = { name: r.company_name, dollars: 0 };
    byCompany[r.company_id].dollars += r.won_dollars;
  }
  const sorted = Object.values(byCompany).sort((a, b) => b.dollars - a.dollars).slice(0, 10);
  const totalWon = sorted.reduce((s, c) => s + c.dollars, 0);

  if (sorted.length === 0) {
    return <p className="text-sm text-subtle text-center py-8">No closed-won data yet</p>;
  }

  const pieData = sorted.map((c) => ({
    name: c.name,
    value: c.dollars,
    pct: totalWon > 0 ? (c.dollars / totalWon * 100) : 0,
  }));

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="w-full lg:w-48 shrink-0">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40}
              paddingAngle={2} stroke="none">
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5">
        {pieData.map((c, i) => (
          <div key={c.name} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-heading font-medium truncate flex-1">{c.name}</span>
            <span className="text-label">{fmt$(c.value)}</span>
            <span className={`font-semibold ${c.pct > 40 ? "text-brand" : "text-heading"}`}>
              {c.pct.toFixed(0)}%
            </span>
            {c.pct > 40 && <span className="text-[9px] font-bold text-brand bg-brand-light px-1 py-0.5 rounded">RISK</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──

export default function ReportsPage() {
  const [filter, setFilter] = useState<FilterPipeline>("ALL");

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
          <ReportCard title="Closed-Won vs Goal" subtitle={`Are we on pace for ${fmt$(ANNUAL_GOAL_CLOSED_WON)} in ${GOAL_YEAR}?`}>
            <ClosedWonGoalChart filter={filter} />
          </ReportCard>

          <ReportCard title="Weighted Forecast — Next 90 Days" subtitle="Can we make payroll without overpromising capacity?">
            <ForecastChart filter={filter} />
          </ReportCard>

          <ReportCard title="Scope / Margin Mix" subtitle="Where is our margin best?">
            <div className="text-center py-8">
              <p className="text-sm text-subtle">Coming soon</p>
              <p className="text-[10px] text-subtle mt-1">Requires scope tracking on opportunities</p>
            </div>
          </ReportCard>

          <ReportCard title="Customer Concentration" subtitle="Are we too dependent on one customer?">
            <ConcentrationChart filter={filter} />
          </ReportCard>
        </div>
      </div>

      {/* My Worklist — placeholder */}
      <div>
        <h2 className="text-xs font-semibold text-label uppercase tracking-wider mb-3">My Worklist</h2>
        <div className="bg-card rounded-2xl p-8 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
          <p className="text-sm text-subtle">Closing This Month, Stale Deals, Bids Out Awaiting, Coverage Gap</p>
          <p className="text-[10px] text-subtle mt-1">Coming next step</p>
        </div>
      </div>
    </div>
  );
}
