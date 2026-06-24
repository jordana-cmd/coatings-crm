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
    <div>
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
        {title} {count > 0 && <span className="text-text-primary">({count})</span>}
      </h2>
      {count === 0 ? (
        <p className="text-sm text-text-muted py-3">{empty}</p>
      ) : (
        children
      )}
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
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
                  className={`w-full text-left rounded-xl p-3 border-2 active:opacity-80
                    ${dq
                      ? "border-dq-border bg-dq-bg"
                      : "border-brand/30 bg-surface"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${dq ? "text-dq line-through" : "text-brand"}`}>
                      {time} — {d.opp.name}
                    </span>
                    {dq && (
                      <span className="text-xs font-bold text-dq bg-dq-bg border border-dq-border px-2 py-0.5 rounded-full">
                        DISQUALIFIED
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${dq ? "text-dq/60" : "text-text-muted"}`}>{d.opp.company_name ?? "—"}</p>
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
              <li key={w.opp.id} className="rounded-xl bg-surface border border-gray-200 p-3 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={() => navigate(`/opp/${w.opp.id}`)}
                    className="font-medium text-text-primary text-left active:text-brand truncate"
                  >
                    {time} — {w.opp.name}
                  </button>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      w.bids.prebid_walk_mandatory
                        ? "bg-dq-bg text-dq border border-dq-border"
                        : "bg-amber-50 text-pending border border-amber-200"
                    }`}
                  >
                    {w.bids.prebid_walk_mandatory ? "Mandatory" : "Optional"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text-muted">{w.opp.company_name ?? "—"}</p>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand font-medium active:text-brand-hover"
                  >
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
                className="w-full text-left rounded-xl bg-surface border border-gray-200 p-3 shadow-sm active:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-text-primary truncate">{f.opp_name}</span>
                  {f.overdue && (
                    <span className="text-xs font-medium text-pending bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Overdue
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-muted mt-0.5">{f.next_action}</p>
                <p className="text-xs text-text-muted/60 mt-0.5">
                  {f.company_name ?? "—"} &middot; Due {new Date(f.next_action_at).toLocaleDateString()}
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
                className="w-full text-left rounded-xl bg-surface border border-gray-200 p-3 shadow-sm active:bg-gray-50
                           flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">{p.name}</p>
                  <p className="text-sm text-text-muted truncate">{p.company_name ?? "—"}</p>
                </div>
                <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-text-primary shrink-0">
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
