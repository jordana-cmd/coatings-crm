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
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {title} {count > 0 && <span className="text-gray-900">({count})</span>}
      </h2>
      {count === 0 ? (
        <p className="text-sm text-gray-400 py-3">{empty}</p>
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
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
                  className={`w-full text-left rounded-xl p-3 border-2 active:bg-red-50
                    ${dq ? "border-red-400 bg-red-50" : "border-red-200 bg-white"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium text-red-700 ${dq ? "line-through" : ""}`}>
                      {time} — {d.opp.name}
                    </span>
                    {dq && (
                      <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                        DISQUALIFIED
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-red-500">{d.opp.company_name ?? "—"}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* 2. Pre-bid walks */}
      {/* TODO: expand to general site visits when a scheduled_visit field exists */}
      <Section title="Pre-Bid Walks" count={walks.length} empty="No walks scheduled today">
        <ul className="space-y-2">
          {walks.map((w) => {
            const time = w.bids.prebid_walk_at
              ? new Date(w.bids.prebid_walk_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(w.opp.job_site_address)}`;
            return (
              <li key={w.opp.id} className="rounded-xl bg-white border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={() => navigate(`/opp/${w.opp.id}`)}
                    className="font-medium text-gray-900 text-left active:text-blue-600 truncate"
                  >
                    {time} — {w.opp.name}
                  </button>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      w.bids.prebid_walk_mandatory
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {w.bids.prebid_walk_mandatory ? "Mandatory" : "Optional"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{w.opp.company_name ?? "—"}</p>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 font-medium active:text-blue-800"
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
                className="w-full text-left rounded-xl bg-white border border-gray-200 p-3 active:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 truncate">{f.opp_name}</span>
                  {f.overdue && (
                    <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                      Overdue
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{f.next_action}</p>
                <p className="text-xs text-gray-400 mt-0.5">
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
                className="w-full text-left rounded-xl bg-white border border-gray-200 p-3 active:bg-gray-50
                           flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="text-sm text-gray-500 truncate">{p.company_name ?? "—"}</p>
                </div>
                <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 shrink-0">
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
