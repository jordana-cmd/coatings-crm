import { useState, type FormEvent } from "react";
import { useGoals, type GoalType, type GoalWithProgress } from "../hooks/useGoals";
import { PIPELINE_LABELS } from "../lib/pipelines";
import { Target } from "lucide-react";

const GOAL_TYPE_LABELS: Record<GoalType, { name: string; unit: string; group: "revenue" | "activity" }> = {
  REVENUE_WON: { name: "Revenue Won", unit: "$", group: "revenue" },
  BIDS_SUBMITTED: { name: "Bids Submitted", unit: "bids", group: "activity" },
  WALKS_ATTENDED: { name: "Walks Attended", unit: "walks", group: "activity" },
  OPPS_SOURCED: { name: "Opps Sourced", unit: "opps", group: "activity" },
  PROPOSALS_SENT: { name: "Proposals Sent", unit: "proposals", group: "activity" },
};
const PERIOD_LABELS: Record<string, string> = { ANNUAL: "Annual", QUARTERLY: "Quarterly", MONTHLY: "Monthly" };
const PACE_COLORS: Record<string, string> = { ahead: "text-gate-met", on_pace: "text-gate-met", behind: "text-brand" };
const PACE_BG: Record<string, string> = { ahead: "bg-gate-met", on_pace: "bg-gate-met", behind: "bg-brand" };

function fmt$(n: number) { return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function fmtVal(n: number, type: GoalType) { return type === "REVENUE_WON" ? fmt$(n) : n.toLocaleString(); }

function GoalCard({ g }: { g: GoalWithProgress }) {
  const meta = GOAL_TYPE_LABELS[g.goal_type as GoalType];
  const target = Number(g.target_value);
  const pctClamped = Math.min(g.pct, 1);
  const pipeLabel = g.pipeline ? PIPELINE_LABELS[g.pipeline as keyof typeof PIPELINE_LABELS] ?? g.pipeline : "All Pipelines";
  const periodLabel = `${PERIOD_LABELS[g.period] ?? g.period} ${g.period_year}${g.period_quarter ? ` Q${g.period_quarter}` : ""}${g.period_month ? `-${String(g.period_month).padStart(2, "0")}` : ""}`;

  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-heading">{meta.name}</h3>
        <span className="text-[10px] text-label">{pipeLabel} · {periodLabel}</span>
      </div>

      {/* Progress bar */}
      <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden my-3">
        <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${PACE_BG[g.pace]}`}
          style={{ width: `${pctClamped * 100}%` }} />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-heading">
          {(g.pct * 100).toFixed(0)}%
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] text-label uppercase tracking-wider">Actual</p>
          <p className="text-sm font-semibold text-heading">{fmtVal(g.actual, g.goal_type as GoalType)}</p>
        </div>
        <div>
          <p className="text-[10px] text-label uppercase tracking-wider">Target</p>
          <p className="text-sm font-semibold text-heading">{fmtVal(target, g.goal_type as GoalType)}</p>
        </div>
        <div>
          <p className="text-[10px] text-label uppercase tracking-wider">Pace</p>
          <p className={`text-sm font-semibold ${PACE_COLORS[g.pace]}`}>
            {g.pace === "ahead" ? "Ahead" : g.pace === "on_pace" ? "On Pace" : "Behind"}
          </p>
        </div>
      </div>

      <p className="text-[10px] text-subtle mt-2 text-center">
        At this rate: {fmtVal(Math.round(g.projected), g.goal_type as GoalType)} by end of period
        {g.pace === "behind" && target > 0 ? ` — ${fmtVal(Math.round(target - g.projected), g.goal_type as GoalType)} short` : ""}
      </p>
    </div>
  );
}

export default function GoalsPage() {
  const { goals, loading, createGoal, updateGoal, deleteGoal } = useGoals();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const revenueGoals = goals.filter((g) => GOAL_TYPE_LABELS[g.goal_type as GoalType]?.group === "revenue");
  const activityGoals = goals.filter((g) => GOAL_TYPE_LABELS[g.goal_type as GoalType]?.group === "activity");

  const handleEdit = (g: GoalWithProgress) => {
    setEditId(g.id);
    setEditVal(String(g.target_value));
  };

  const handleSaveEdit = async () => {
    if (editId && editVal) {
      await updateGoal(editId, parseFloat(editVal));
      setEditId(null);
      // Reload page to re-compute
      window.location.reload();
    }
  };

  const handleDelete = async (id: string) => {
    await deleteGoal(id);
    window.location.reload();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand" /></div>;
  }

  return (
    <div className="space-y-6 pb-16 md:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-heading">Goals</h1>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium active:bg-brand-hover">
          + Set Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
          <Target size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-subtle">No goals set yet</p>
          <button onClick={() => setShowCreate(true)} className="text-sm text-brand font-medium mt-2">Set your first goal</button>
        </div>
      ) : (
        <>
          {/* Revenue goals */}
          {revenueGoals.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-label uppercase tracking-wider mb-2">Revenue Goals <span className="normal-case font-normal">— outcomes</span></h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {revenueGoals.map((g) => (
                  <div key={g.id} className="relative group">
                    <GoalCard g={g} />
                    <div className="absolute top-3 right-3 hidden group-hover:flex gap-1">
                      <button onClick={() => handleEdit(g)} className="text-[10px] text-brand bg-brand-light px-1.5 py-0.5 rounded">Edit</button>
                      <button onClick={() => handleDelete(g.id)} className="text-[10px] text-dq bg-dq-bg px-1.5 py-0.5 rounded">Del</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity goals */}
          {activityGoals.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-label uppercase tracking-wider mb-2">Activity Goals <span className="normal-case font-normal">— leading indicators you control</span></h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activityGoals.map((g) => (
                  <div key={g.id} className="relative group">
                    <GoalCard g={g} />
                    <div className="absolute top-3 right-3 hidden group-hover:flex gap-1">
                      <button onClick={() => handleEdit(g)} className="text-[10px] text-brand bg-brand-light px-1.5 py-0.5 rounded">Edit</button>
                      <button onClick={() => handleDelete(g.id)} className="text-[10px] text-dq bg-dq-bg px-1.5 py-0.5 rounded">Del</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit modal */}
      {editId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm" style={{ boxShadow: "var(--shadow-card)" }}>
            <h2 className="text-lg font-semibold text-heading mb-4">Edit Target</h2>
            <input type="number" value={editVal} onChange={(e) => setEditVal(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40 mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditId(null)} className="px-4 py-2 text-sm text-label">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && <CreateGoalModal onCreate={createGoal} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateGoalModal({ onCreate, onClose }: {
  onCreate: (input: { goal_type: GoalType; pipeline?: string; period: string; period_year: number; period_quarter?: number; period_month?: number; target_value: number; owner_id?: string | null }) => Promise<{ error: string | null }>;
  onClose: () => void;
}) {
  const [goalType, setGoalType] = useState<GoalType>("REVENUE_WON");
  const [period, setPeriod] = useState("ANNUAL");
  const [year, setYear] = useState(2027);
  const [quarter, setQuarter] = useState<number | undefined>();
  const [month, setMonth] = useState<number | undefined>();
  const [pipeline, setPipeline] = useState("");
  const [target, setTarget] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sub, setSub] = useState(false);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setSub(true); setErr(null);
    const res = await onCreate({
      goal_type: goalType, pipeline: pipeline || undefined,
      period, period_year: year,
      period_quarter: period === "QUARTERLY" ? quarter : undefined,
      period_month: period === "MONTHLY" ? month : undefined,
      target_value: parseFloat(target),
      owner_id: null,
    });
    if (res.error) { setErr(res.error); setSub(false); }
    else { onClose(); window.location.reload(); }
  };

  const cls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={handle} className="bg-card rounded-2xl p-6 w-full max-w-md" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-heading">Set a Goal</h2>
          <button type="button" onClick={onClose} className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        <div className="space-y-3">
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Goal Type</label>
            <select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)} className={cls}>
              <option value="REVENUE_WON">Revenue Won ($)</option>
              <option value="BIDS_SUBMITTED">Bids Submitted</option>
              <option value="WALKS_ATTENDED">Walks Attended</option>
              <option value="OPPS_SOURCED">Opps Sourced</option>
              <option value="PROPOSALS_SENT">Proposals Sent</option>
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Period</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className={cls}>
                <option value="ANNUAL">Annual</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="MONTHLY">Monthly</option>
              </select></div>
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Year</label>
              <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={cls} /></div>
          </div>
          {period === "QUARTERLY" && (
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Quarter</label>
              <select value={quarter ?? ""} onChange={(e) => setQuarter(parseInt(e.target.value))} className={cls}>
                <option value="">Select</option><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option>
              </select></div>
          )}
          {period === "MONTHLY" && (
            <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Month</label>
              <select value={month ?? ""} onChange={(e) => setMonth(parseInt(e.target.value))} className={cls}>
                <option value="">Select</option>
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString(undefined, { month: "long" })}</option>)}
              </select></div>
          )}
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Pipeline</label>
            <select value={pipeline} onChange={(e) => setPipeline(e.target.value)} className={cls}>
              <option value="">All Pipelines</option>
              <option value="PUBLIC_BID">Public Bid</option>
              <option value="GC_CHASE">GC Chase</option>
              <option value="FACILITY">Facility</option>
            </select></div>
          <div><label className="block text-[10px] text-label uppercase tracking-wider mb-0.5">Target {goalType === "REVENUE_WON" ? "($)" : "(count)"}</label>
            <input type="number" step={goalType === "REVENUE_WON" ? "1000" : "1"} required value={target} onChange={(e) => setTarget(e.target.value)} className={cls}
              placeholder={goalType === "REVENUE_WON" ? "10000000" : "50"} /></div>
        </div>
        {err && <p className="text-brand text-sm mt-3 text-center">{err}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-label">Cancel</button>
          <button type="submit" disabled={sub}
            className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg active:bg-brand-hover disabled:opacity-50">
            {sub ? "Saving..." : "Create Goal"}</button>
        </div>
      </form>
    </div>
  );
}
