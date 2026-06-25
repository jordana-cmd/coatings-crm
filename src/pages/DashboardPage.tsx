import { useNavigate } from "react-router-dom";
import { useDashboard } from "../hooks/useDashboard";
import { useOpportunities } from "../hooks/useOpportunities";
import { useRevenueGoal } from "../hooks/useGoals";
import { useClosedWonVsGoal } from "../hooks/useReports";
import { daysElapsedInYear, daysInYear } from "../config/constants";
import { STAGE_LABELS, PIPELINE_LABELS, type Pipeline } from "../lib/pipelines";
import KpiCard from "../components/dashboard/KpiCard";
import { DollarSign, BarChart3, Shield, Target } from "lucide-react";

function fmt$(n: number) {
  if (n === 0) return "—";
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtPct(n: number | null) {
  if (n == null) return "—";
  return (n * 100).toFixed(1) + "%";
}

function GoalPaceCard() {
  const navigate = useNavigate();
  const { target, year } = useRevenueGoal();
  const { data: wonData, loading } = useClosedWonVsGoal();

  if (loading) return null;

  const totalWon = wonData.reduce((s, r) => s + r.closed_won_ytd, 0);
  const elapsed = daysElapsedInYear(year);
  const total = daysInYear(year);
  const projected = elapsed > 0 ? (totalWon / elapsed) * total : 0;
  const onPace = projected >= target;
  const pct = target > 0 ? Math.min(totalWon / target, 1) : 0;
  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <button onClick={() => navigate("/goals")}
      className="w-full bg-card rounded-2xl p-4 flex items-center gap-4 active:bg-gray-50 text-left"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
      <Target size={20} className={onPace ? "text-gate-met" : "text-brand"} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-label">{year} Revenue Goal</span>
          <span className={`text-xs font-semibold ${onPace ? "text-gate-met" : "text-brand"}`}>
            {onPace ? "On pace" : "Behind pace"}
          </span>
        </div>
        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`absolute inset-y-0 left-0 rounded-full ${onPace ? "bg-gate-met" : "bg-brand"}`}
            style={{ width: `${pct * 100}%` }} />
        </div>
        <p className="text-[10px] text-subtle mt-1">
          {fmt(totalWon)} of {fmt(target)} · projected {fmt(Math.round(projected))}
        </p>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const { data, loading } = useDashboard();
  const { opps, loading: oppsLoading } = useOpportunities();
  const navigate = useNavigate();

  if (loading || oppsLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
      </div>
    );
  }

  const d = data!;
  const recentOpps = opps.slice(0, 10);

  // Compute a blended win rate for the ring (supplementary visual)
  const totalDecided = d.winRates.reduce((s, w) => s + w.decided, 0);
  const totalWins = d.winRates.reduce((s, w) => s + w.wins, 0);
  const blendedRate = totalDecided > 0 ? totalWins / totalDecided : null;

  // Per-pipeline breakdown string
  const perPipeline = d.winRates.length > 0
    ? d.winRates.map((w) =>
        `${PIPELINE_LABELS[w.pipeline as Pipeline] ?? w.pipeline}: ${fmtPct(w.rate)}`
      ).join("  ·  ")
    : "Awaiting first result";

  return (
    <div className="space-y-6 pb-16 md:pb-6">
      <h1 className="text-xl font-semibold text-heading">Dashboard Overview</h1>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Outstanding Bid $"
          value={fmt$(d.outstandingBid.total)}
          subLabel={d.outstandingBid.count > 0 ? `${d.outstandingBid.count} open bids` : "No open bids"}
          badge={<DollarSign size={14} className="text-subtle" />}
        />
        <KpiCard
          label="Win Rate (90d)"
          value={perPipeline}
          subLabel={totalDecided > 0 ? `${totalWins}W / ${totalDecided} decided` : undefined}
          ring={blendedRate}
        />
        <KpiCard
          label="Avg Spread to Low"
          value={fmtPct(d.spreadToLow.avg)}
          subLabel={d.spreadToLow.sampleSize > 0 ? `${d.spreadToLow.sampleSize} bids with tab data` : "Awaiting tab data"}
          badge={<BarChart3 size={14} className="text-subtle" />}
        />
        <KpiCard
          label="% Pipeline Bonded"
          value={d.bondExposure.totalDollars > 0 ? fmtPct(d.bondExposure.pct) : "—"}
          subLabel={d.bondExposure.totalDollars > 0
            ? `${fmt$(d.bondExposure.bondedDollars)} of ${fmt$(d.bondExposure.totalDollars)}`
            : "No outstanding bids"}
          badge={<Shield size={14} className="text-subtle" />}
        />
      </div>

      {/* Goal pace summary */}
      <GoalPaceCard />

      {/* Recent opps table */}
      <div className="bg-card rounded-2xl overflow-hidden"
           style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
        <div className="px-5 py-4 border-b border-card-border">
          <h2 className="text-sm font-semibold text-heading">Recent Opportunities</h2>
        </div>
        {recentOpps.length === 0 ? (
          <div className="px-5 py-10 text-center text-subtle text-sm">
            No opportunities yet — create one from the Pipeline view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] text-label uppercase tracking-wider">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Stage</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {recentOpps.map((opp) => (
                  <tr key={opp.id} onClick={() => navigate(`/opp/${opp.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-5 py-3.5 font-medium text-heading">{opp.name}</td>
                    <td className="px-5 py-3.5 text-label">{opp.company_name ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-heading">
                        {STAGE_LABELS[opp.stage] ?? opp.stage}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-heading">
                      {opp.amount != null ? "$" + opp.amount.toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
