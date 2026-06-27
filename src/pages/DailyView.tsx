import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDailyView } from "../hooks/useDailyView";
import { usePins } from "../hooks/usePins";
import { useGoals } from "../hooks/useGoals";
import { useTouchList, useSetNextAction } from "../hooks/useCadence";
import { useQuickLog } from "../hooks/useQuickLog";
import { useAuth } from "../hooks/useAuth";
import { isDisqualified } from "../lib/gates/disqualification";
import { PIPELINE_LABELS, STAGE_LABELS } from "../lib/pipelines";
import type { OppWithBids } from "../lib/gates/types";
import type { TouchListItem } from "../lib/cadence";
import type { Database } from "../lib/database.types";
import QuickLogSheet from "../components/quick-log/QuickLogSheet";
import { Star, Clock, CheckCircle2, Pencil, Phone } from "lucide-react";
import { supabase } from "../lib/supabase";

type ActivityType = Database["public"]["Enums"]["activity_type"];

function fmt$(n: number) { return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }

function relDays(iso: string | null): string {
  if (!iso) return "never";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

// ── Progress-to-Goal bar ──

function GoalBar() {
  const { goals, loading } = useGoals();
  if (loading) return null;

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
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03))" }}>
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

  if (outlook7d.length === 0) return null;

  const now = new Date();

  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03))" }}>
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

// ── Hot List ──

function HotList() {
  const navigate = useNavigate();
  const { pins, loading } = usePins();

  if (loading || pins.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03))" }}>
      <div className="flex items-center gap-2 mb-3">
        <Star size={14} className="text-label" />
        <h2 className="text-xs font-semibold text-label uppercase tracking-wider">
          Hot List <span className="text-heading">({pins.length})</span>
        </h2>
      </div>
      <div className="space-y-1.5">
        {pins.map((p) => (
          <button key={p.id} onClick={() => navigate(`/opp/${p.id}`)}
            className="w-full text-left rounded-lg border border-card-border p-2.5 active:bg-gray-50 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-heading truncate">{p.name}</p>
              <p className="text-[10px] text-label truncate">{p.company_name ?? "—"}</p>
            </div>
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-heading shrink-0">
              {STAGE_LABELS[p.stage] ?? p.stage}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Set Next Action Modal ──

function SetNextActionModal({ item, onSave, onClose }: {
  item: TouchListItem;
  onSave: (action: string, date: string) => void;
  onClose: () => void;
}) {
  const existing = item.nextAction.source === "manual" ? item.nextAction : null;
  const [action, setAction] = useState(existing?.action ?? "");
  const [date, setDate] = useState(existing?.dueDate ?? new Date().toISOString().slice(0, 10));

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-heading">Set Next Action</h2>
          <button onClick={onClose} className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        <p className="text-xs text-label mb-3 truncate">{item.name}</p>
        <div className="space-y-3">
          <input value={action} onChange={(e) => setAction(e.target.value)}
            placeholder="What's the next step?" className={inputCls} autoFocus />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <button onClick={() => { if (action.trim() && date) onSave(action.trim(), date); }}
            disabled={!action.trim() || !date}
            className="w-full rounded-lg bg-brand text-white py-3 text-sm font-medium active:bg-brand-hover disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Touch Row ──

function TouchRow({ item, onLogTouch, onSetNext }: {
  item: TouchListItem;
  onLogTouch: (item: TouchListItem) => void;
  onSetNext: (item: TouchListItem) => void;
}) {
  const navigate = useNavigate();
  const urgencyColor = item.nextAction.urgency === "overdue" ? "border-l-brand"
    : item.nextAction.urgency === "due_today" ? "border-l-pending"
    : "border-l-gray-300";

  const motionLabel = item.pipeline ? PIPELINE_LABELS[item.pipeline as keyof typeof PIPELINE_LABELS] ?? item.pipeline : "Contact";

  const handleNav = () => {
    if (item.type === "opp") navigate(`/opp/${item.id}`);
    else navigate(`/contacts/${item.id}`);
  };

  return (
    <div className={`rounded-lg border-l-[3px] ${urgencyColor} bg-card px-3 py-3`}
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      {/* Top: name + context */}
      <div className="flex items-start justify-between gap-2">
        <button onClick={handleNav} className="text-left min-w-0 flex-1 group">
          <p className="text-sm font-medium text-heading truncate group-active:text-brand">{item.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10px] text-label truncate">{item.companyName ?? "—"}</span>
            <span className="text-[10px] text-subtle">·</span>
            <span className="text-[10px] font-medium text-label">{motionLabel}</span>
            {item.stage && (
              <>
                <span className="text-[10px] text-subtle">·</span>
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-heading">
                  {STAGE_LABELS[item.stage] ?? item.stage}
                </span>
              </>
            )}
          </div>
        </button>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${
          item.nextAction.source === "manual"
            ? "bg-blue-50 text-blue-600"
            : "bg-gray-100 text-subtle"
        }`}>
          {item.nextAction.source === "manual" ? "Planned" : "Cadence"}
        </span>
      </div>

      {/* Action text + due info */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-heading truncate flex-1">{item.nextAction.action}</p>
        <div className="text-right shrink-0">
          <p className={`text-[10px] font-semibold ${
            item.nextAction.urgency === "overdue" ? "text-brand" : item.nextAction.urgency === "due_today" ? "text-pending" : "text-label"
          }`}>
            {item.nextAction.urgency === "overdue"
              ? `${Math.floor((Date.now() - new Date(item.nextAction.dueDate).getTime()) / 86400000)}d overdue`
              : item.nextAction.urgency === "due_today" ? "Due today"
              : item.nextAction.dueDate}
          </p>
          {item.type === "contact" && (
            <p className="text-[9px] text-subtle">Last: {relDays(item.lastContactedAt)}</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-2.5">
        <button onClick={() => onLogTouch(item)}
          className="flex items-center gap-1 rounded-md bg-brand text-white px-2.5 py-1.5 text-[11px] font-medium active:bg-brand-hover">
          <Phone size={11} /> Log touch
        </button>
        <button onClick={() => onSetNext(item)}
          className="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-[11px] font-medium text-heading active:bg-gray-50">
          <Pencil size={11} /> Set next
        </button>
      </div>
    </div>
  );
}

// ── Touch List Section ──

function TouchListSection() {
  const { dueNow, comingUp, loading, refetch } = useTouchList();
  const { setNextAction } = useSetNextAction();
  const { log } = useQuickLog();
  const { user } = useAuth();
  const [logTarget, setLogTarget] = useState<TouchListItem | null>(null);
  const [nextTarget, setNextTarget] = useState<TouchListItem | null>(null);
  const [showComingUp, setShowComingUp] = useState(false);

  const overdueItems = dueNow.filter((i) => i.nextAction.urgency === "overdue");
  const dueTodayItems = dueNow.filter((i) => i.nextAction.urgency === "due_today");
  const totalDue = dueNow.length;

  const handleLogTouch = async (item: TouchListItem, input: {
    type: ActivityType; note?: string; contactId?: string; nextAction?: string; nextActionAt?: string;
  }) => {
    if (item.type === "opp") {
      await log({ opportunityId: item.id, ...input });
    } else {
      // For contacts, log a contact note (activities require opportunity_id)
      if (supabase && user) {
        await supabase.from("contact_notes").insert({
          contact_id: item.id,
          author_id: user.id,
          body: input.note || `Logged ${input.type.toLowerCase()} touch`,
        });
      }
    }
    setLogTarget(null);
    refetch();
  };

  const handleSetNext = async (action: string, date: string) => {
    if (!nextTarget) return;
    await setNextAction(nextTarget.type, nextTarget.id, action, date);
    setNextTarget(null);
    refetch();
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03))" }}>
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03))" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-label" />
            <h2 className="text-sm font-semibold text-heading">
              {totalDue > 0 ? `${totalDue} item${totalDue !== 1 ? "s" : ""} to touch today` : "Touch List"}
            </h2>
          </div>
          {totalDue > 0 && (
            <div className="flex items-center gap-1.5">
              {overdueItems.length > 0 && (
                <span className="rounded-full bg-brand-light text-brand px-2 py-0.5 text-[10px] font-semibold">
                  {overdueItems.length} overdue
                </span>
              )}
              {dueTodayItems.length > 0 && (
                <span className="rounded-full bg-pending-light text-pending px-2 py-0.5 text-[10px] font-semibold">
                  {dueTodayItems.length} due
                </span>
              )}
            </div>
          )}
        </div>

        {totalDue === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 size={32} className="text-gate-met mx-auto mb-2" />
            <p className="text-sm font-medium text-heading">You're caught up</p>
            <p className="text-xs text-subtle mt-1">Nothing due today</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overdue group */}
            {overdueItems.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-brand uppercase tracking-wider mb-2">Overdue</p>
                <div className="space-y-2">
                  {overdueItems.map((item) => (
                    <TouchRow key={`${item.type}-${item.id}`} item={item}
                      onLogTouch={setLogTarget} onSetNext={setNextTarget} />
                  ))}
                </div>
              </div>
            )}

            {/* Due Today group */}
            {dueTodayItems.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-pending uppercase tracking-wider mb-2">Due Today</p>
                <div className="space-y-2">
                  {dueTodayItems.map((item) => (
                    <TouchRow key={`${item.type}-${item.id}`} item={item}
                      onLogTouch={setLogTarget} onSetNext={setNextTarget} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Coming Up toggle */}
        {comingUp.length > 0 && (
          <div className="mt-4 pt-4 border-t border-card-border">
            <button onClick={() => setShowComingUp(!showComingUp)}
              className="text-xs font-medium text-label hover:text-heading">
              {showComingUp ? "Hide" : "Show"} coming up ({comingUp.length})
            </button>
            {showComingUp && (
              <div className="space-y-2 mt-3">
                {comingUp.map((item) => (
                  <TouchRow key={`${item.type}-${item.id}`} item={item}
                    onLogTouch={setLogTarget} onSetNext={setNextTarget} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* QuickLog sheet for opps / contact note for contacts */}
      {logTarget && logTarget.type === "opp" && (
        <QuickLogSheet
          onLog={(input) => handleLogTouch(logTarget, input)}
          onClose={() => setLogTarget(null)}
        />
      )}

      {/* Simple touch note modal for contacts */}
      {logTarget && logTarget.type === "contact" && (
        <ContactTouchModal
          contact={logTarget}
          onSave={async (note) => {
            await handleLogTouch(logTarget, { type: "NOTE", note });
          }}
          onClose={() => setLogTarget(null)}
        />
      )}

      {/* Set next action modal */}
      {nextTarget && (
        <SetNextActionModal item={nextTarget} onSave={handleSetNext}
          onClose={() => setNextTarget(null)} />
      )}
    </>
  );
}

// ── Simple contact touch modal ──

function ContactTouchModal({ contact, onSave, onClose }: {
  contact: TouchListItem; onSave: (note: string) => void; onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-heading">Log Touch</h2>
          <button onClick={onClose} className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        <p className="text-xs text-label mb-3">{contact.name} · {contact.companyName ?? "—"}</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Quick note (optional)" rows={2} className={inputCls} autoFocus />
        <button onClick={() => onSave(note.trim())}
          className="w-full mt-3 rounded-lg bg-brand text-white py-3 text-sm font-medium active:bg-brand-hover">
          Log it
        </button>
      </div>
    </div>
  );
}

// ── Main ──

export default function DailyView() {
  const { loading } = useDailyView();
  const { loading: pinsLoading } = usePins();

  if (loading || pinsLoading) {
    return <div className="flex items-center justify-center h-48"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand" /></div>;
  }

  return (
    <div className="space-y-4 pb-16 md:pb-6">
      <h1 className="text-xl font-semibold text-heading">Today</h1>

      {/* 1. Goal bar */}
      <GoalBar />

      {/* 2. Touch list (hero) */}
      <TouchListSection />

      {/* 3. 7-day outlook */}
      <Outlook7d />

      {/* 4. Hot list */}
      <HotList />
    </div>
  );
}
