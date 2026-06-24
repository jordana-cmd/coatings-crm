import { useNavigate } from "react-router-dom";
import { useDailyView } from "../hooks/useDailyView";
import { usePins } from "../hooks/usePins";
import { isDisqualified } from "../lib/gates/disqualification";
import { STAGE_LABELS } from "../lib/pipelines";
import type { OppWithBids } from "../lib/gates/types";

function Section({
  title,
  count,
  children,
  empty,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  empty: string;
}) {
  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-card-border">
        <h2 className="text-xs font-semibold text-label uppercase tracking-wider">
          {title} {count > 0 && <span className="text-heading">({count})</span>}
        </h2>
      </div>
      <div className="p-4">
        {count === 0 ? (
          <p className="text-sm text-subtle text-center py-4">{empty}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export default function DailyView() {
  const navigate = useNavigate();
  const { deadlines, walks, followUps, loading } = useDailyView();
  const { pins, loading: pinsLoading } = usePins();

  if (loading || pinsLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-shell-border border-t-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16 md:pb-6">
      <h1 className="text-xl font-semibold text-heading">Today</h1>

      {/* 1. Bid deadlines */}
      <Section title="Bid Deadlines" count={deadlines.length} empty="No bid deadlines today">
        <ul className="space-y-2">
          {deadlines.map((d) => {
            const dq = isDisqualified({ ...d.opp, bids: d.bids } as OppWithBids);
            const time = d.bids.bid_due_at
              ? new Date(d.bids.bid_due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";
            return (
              <li key={d.opp.id}>
                <button
                  onClick={() => navigate(`/opp/${d.opp.id}`)}
                  className={`w-full text-left rounded-lg p-3 border active:opacity-80
                    ${dq ? "border-dq-border bg-dq-bg" : "border-brand/20 bg-brand-light"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium text-sm ${dq ? "text-dq line-through" : "text-brand"}`}>
                      {time} — {d.opp.name}
                    </span>
                    {dq && (
                      <span className="text-[10px] font-bold text-dq bg-dq-bg border border-dq-border px-1.5 py-0.5 rounded">
                        DQ
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-label mt-0.5">{d.opp.company_name ?? "—"}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* 2. Pre-bid walks */}
      <Section title="Pre-Bid Walks" count={walks.length} empty="No walks scheduled today">
        <ul className="space-y-2">
          {walks.map((w) => {
            const time = w.bids.prebid_walk_at
              ? new Date(w.bids.prebid_walk_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(w.opp.job_site_address)}`;
            return (
              <li key={w.opp.id} className="rounded-lg border border-card-border p-3">
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={() => navigate(`/opp/${w.opp.id}`)}
                    className="font-medium text-sm text-heading text-left active:text-brand truncate"
                  >
                    {time} — {w.opp.name}
                  </button>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    w.bids.prebid_walk_mandatory
                      ? "bg-dq-bg text-dq border border-dq-border"
                      : "bg-pending-light text-pending"
                  }`}>
                    {w.bids.prebid_walk_mandatory ? "Mandatory" : "Optional"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-label">{w.opp.company_name ?? "—"}</p>
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-brand font-medium">
                    Directions
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* 3. Follow-ups due */}
      <Section title="Follow-ups Due" count={followUps.length} empty="No follow-ups due today">
        <ul className="space-y-2">
          {followUps.map((f) => (
            <li key={f.id}>
              <button
                onClick={() => navigate(`/opp/${f.opportunity_id}`)}
                className="w-full text-left rounded-lg border border-card-border p-3 active:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-heading truncate">{f.opp_name}</span>
                  {f.overdue && (
                    <span className="text-[10px] font-medium text-pending bg-pending-light px-1.5 py-0.5 rounded">
                      Overdue
                    </span>
                  )}
                </div>
                <p className="text-xs text-label mt-0.5">{f.next_action}</p>
                <p className="text-[10px] text-subtle mt-0.5">
                  {f.company_name ?? "—"} · Due {new Date(f.next_action_at).toLocaleDateString()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {/* 4. Hot list */}
      <Section title="Hot List" count={pins.length} empty="No pinned opportunities — pin from any opp detail">
        <ul className="space-y-2">
          {pins.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => navigate(`/opp/${p.id}`)}
                className="w-full text-left rounded-lg border border-card-border p-3 active:bg-gray-50
                           flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm text-heading truncate">{p.name}</p>
                  <p className="text-xs text-label truncate">{p.company_name ?? "—"}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-heading shrink-0">
                  {STAGE_LABELS[p.stage] ?? p.stage}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
