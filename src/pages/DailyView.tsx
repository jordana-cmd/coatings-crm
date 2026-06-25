import { useNavigate } from "react-router-dom";
import { useDailyView } from "../hooks/useDailyView";
import { usePins } from "../hooks/usePins";
import { useGoals } from "../hooks/useGoals";
import { isDisqualified } from "../lib/gates/disqualification";
import { STAGE_LABELS } from "../lib/pipelines";
import type { OppWithBids } from "../lib/gates/types";
import { CalendarClock, ClipboardCheck, Star, Clock } from "lucide-react";

function fmt$(n: number) { return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }

// ── Progress-to-Goal bar ──

function GoalBar() {
  const { goals, loading } = useGoals();
  if (loading) return null;

  // Find the most relevant revenue goal: current-period monthly > quarterly > annual
  const revenueGoals = goals.filter((g) => g.goal_type === "REVENUE_WON");
  const goal = revenueGoals.find((g) => g.period === "MONTHLY")
    ?? revenueGoals.find((g) => g.period === "QUARTERLY")
    ?? revenueGoals.find((g) => g.period === "ANNUAL")
    ?? null;

  if (!goal) return null;

  const target = Number(goal.target_value);
  const pctClamped = Math.min(goal.pct, 1);
  const periodLabel = goal.period === "ANNUAL" ? goal.period_year
    : goal.period === "QUARTERLY" ? `Q${goal.period_quarter} ${goal.period_year}`
    : `${goal.period_month}/${goal.period_year}`;

  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-label">
          {fmt$(goal.actual)} of {fmt$(target)} — Revenue Won {periodLabel}
        </span>
        <span className={`text-xs font-semibold ${goal.pace === "behind" ? "text-brand" : "text-gate-met"}`}>
          {(goal.pct * 100).toFixed(0)}% Won
        </span>
      </div>
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${goal.pace === "behind" ? "bg-brand" : "bg-gate-met"}`}
          style={{ width: `${pctClamped * 100}%` }} />
      </div>
      {goal.actual === 0 && (
        <p className="text-[10px] text-subtle mt-1.5 text-center">Just getting started</p>
      )}
    </div>
  );
}

// ── 7-Day Outlook ──

function Outlook7d() {
  const navigate = useNavigate();
  const { outlook7d } = useDailyView();

  if (outlook7d.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
        <h2 className="text-xs font-semibold text-label uppercase tracking-wider mb-3">7-Day Bid Outlook</h2>
        <div className="text-center py-6">
          <CalendarClock size={28} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-subtle">No bids due in the next 7 days</p>
        </div>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
      <h2 className="text-xs font-semibold text-label uppercase tracking-wider mb-3">
        7-Day Bid Outlook <span className="text-heading">({outlook7d.length})</span>
      </h2>
      <div className="space-y-1">
        {outlook7d.map((d) => {
          const dq = isDisqualified({ ...d.opp, bids: d.bids } as OppWithBids);
          const due = d.bids.bid_due_at ? new Date(d.bids.bid_due_at) : null;
          const hoursUntil = due ? (due.getTime() - now.getTime()) / 3600000 : 999;
          const borderColor = hoursUntil <= 24 ? "border-l-brand" : hoursUntil <= 120 ? "border-l-pending" : "border-l-gray-300";
          const dayLabel = due ? due.toLocaleDateString(undefined, { weekday: "short" }) : "—";
          const timeLabel = due ? due.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

          return (
            <button key={d.opp.id} onClick={() => navigate(`/opp/${d.opp.id}`)}
              className={`w-full text-left rounded-r-lg border-l-[3px] ${borderColor} px-3 py-2 active:bg-gray-50 flex items-center gap-3`}>
              <span className="text-[10px] font-semibold text-label w-8 shrink-0">{dayLabel}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${dq ? "text-dq line-through" : "text-heading"}`}>
                  {d.opp.amount != null ? `${fmt$(d.opp.amount)} — ` : ""}{d.opp.name}
                </p>
                <p className="text-[10px] text-label truncate">{d.opp.company_name ?? "—"} · Due {timeLabel}</p>
              </div>
              {dq && <span className="text-[9px] font-bold text-dq bg-dq-bg border border-dq-border px-1 py-0.5 rounded shrink-0">DQ</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Action Grid Column ──

function ActionCard({ title, count, icon: Icon, children, emptyIcon: EmptyIcon, emptyText }: {
  title: string; count: number; icon: typeof Clock; children: React.ReactNode;
  emptyIcon: typeof Clock; emptyText: string;
}) {
  return (
    <div className="bg-card rounded-2xl overflow-hidden h-full flex flex-col" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
      <div className="px-4 py-3 border-b border-card-border flex items-center gap-2">
        <Icon size={14} className="text-label" />
        <h2 className="text-xs font-semibold text-label uppercase tracking-wider">
          {title} {count > 0 && <span className="text-heading">({count})</span>}
        </h2>
      </div>
      <div className="flex-1 p-3">
        {count === 0 ? (
          <div className="text-center py-6">
            <EmptyIcon size={24} className="text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-subtle">{emptyText}</p>
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ── Main ──

export default function DailyView() {
  const navigate = useNavigate();
  const { deadlines, walks, followUps, loading } = useDailyView();
  const { pins, loading: pinsLoading } = usePins();

  if (loading || pinsLoading) {
    return <div className="flex items-center justify-center h-48"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand" /></div>;
  }

  const todayItems = [...deadlines.map((d) => ({ type: "deadline" as const, ...d })), ...walks.map((w) => ({ type: "walk" as const, ...w }))];

  return (
    <div className="space-y-4 pb-16 md:pb-6">
      <h1 className="text-xl font-semibold text-heading">Today</h1>

      {/* 1. Goal bar */}
      <GoalBar />

      {/* 2. 7-day outlook */}
      <Outlook7d />

      {/* 3. Action grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Col 1: Today's deadlines + walks */}
        <ActionCard title="Today's Deadlines" count={todayItems.length} icon={Clock}
          emptyIcon={Clock} emptyText="No deadlines or walks today">
          <ul className="space-y-1.5">
            {deadlines.map((d) => {
              const dq = isDisqualified({ ...d.opp, bids: d.bids } as OppWithBids);
              const time = d.bids.bid_due_at ? new Date(d.bids.bid_due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
              return (
                <li key={`dl-${d.opp.id}`}>
                  <button onClick={() => navigate(`/opp/${d.opp.id}`)}
                    className={`w-full text-left rounded-lg p-2.5 border active:opacity-80 ${dq ? "border-dq-border bg-dq-bg" : "border-brand/20 bg-brand-light"}`}>
                    <span className={`text-xs font-medium ${dq ? "text-dq line-through" : "text-brand"}`}>{time} — {d.opp.name}</span>
                    <p className="text-[10px] text-label mt-0.5">{d.opp.company_name ?? "—"}</p>
                  </button>
                </li>
              );
            })}
            {walks.map((w) => {
              const time = w.bids.prebid_walk_at ? new Date(w.bids.prebid_walk_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(w.opp.job_site_address)}`;
              return (
                <li key={`wk-${w.opp.id}`} className="rounded-lg border border-card-border p-2.5">
                  <div className="flex items-center justify-between">
                    <button onClick={() => navigate(`/opp/${w.opp.id}`)} className="text-xs font-medium text-heading active:text-brand truncate">
                      {time} — {w.opp.name}
                    </button>
                    <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${w.bids.prebid_walk_mandatory ? "bg-dq-bg text-dq" : "bg-pending-light text-pending"}`}>
                      {w.bids.prebid_walk_mandatory ? "Mandatory" : "Optional"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-label">{w.opp.company_name ?? "—"}</p>
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand font-medium">Directions</a>
                  </div>
                </li>
              );
            })}
          </ul>
        </ActionCard>

        {/* Col 2: Follow-ups */}
        <ActionCard title="Follow-ups Due" count={followUps.length} icon={ClipboardCheck}
          emptyIcon={ClipboardCheck} emptyText="No follow-ups due">
          <ul className="space-y-1.5">
            {followUps.map((f) => (
              <li key={f.id}>
                <button onClick={() => navigate(`/opp/${f.opportunity_id}`)}
                  className="w-full text-left rounded-lg border border-card-border p-2.5 active:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-heading truncate">{f.opp_name}</span>
                    {f.overdue && <span className="text-[9px] font-medium text-pending bg-pending-light px-1 py-0.5 rounded">Overdue</span>}
                  </div>
                  <p className="text-[10px] text-label mt-0.5 truncate">{f.next_action}</p>
                  <p className="text-[10px] text-subtle mt-0.5">{f.company_name ?? "—"}</p>
                </button>
              </li>
            ))}
          </ul>
        </ActionCard>

        {/* Col 3: Hot list */}
        <ActionCard title="Hot List" count={pins.length} icon={Star}
          emptyIcon={Star} emptyText="Pin opps from any detail page">
          <ul className="space-y-1.5">
            {pins.map((p) => (
              <li key={p.id}>
                <button onClick={() => navigate(`/opp/${p.id}`)}
                  className="w-full text-left rounded-lg border border-card-border p-2.5 active:bg-gray-50 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-heading truncate">{p.name}</p>
                    <p className="text-[10px] text-label truncate">{p.company_name ?? "—"}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-heading shrink-0">
                    {STAGE_LABELS[p.stage] ?? p.stage}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </ActionCard>
      </div>
    </div>
  );
}
