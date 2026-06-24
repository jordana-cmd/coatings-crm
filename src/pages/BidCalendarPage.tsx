import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCalendarEvents, type CalendarEvent } from "../hooks/useCalendarEvents";
import { isDisqualified } from "../lib/gates/disqualification";
import type { OppWithBids } from "../lib/gates/types";
import type { Database } from "../lib/database.types";

type Pipeline = Database["public"]["Enums"]["pipeline_type"];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const FILTER_OPTIONS: { value: Pipeline | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PUBLIC_BID", label: "Public Bid" },
  { value: "GC_CHASE", label: "GC Chase" },
  { value: "FACILITY", label: "Facility" },
];
const PIPELINE_TAG: Record<string, string> = {
  PUBLIC_BID: "PB",
  GC_CHASE: "GC",
  FACILITY: "FAC",
};

function buildGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function eventStyle(event: CalendarEvent): { bg: string; text: string } {
  const dq =
    event.kind === "bid_due" &&
    isDisqualified({ ...event.opp, bids: event.bids } as OppWithBids);
  if (dq) return { bg: "bg-dq", text: "text-white line-through opacity-75" };
  if (event.kind === "walk") {
    return event.mandatory
      ? { bg: "bg-orange-500", text: "text-white" }
      : { bg: "bg-pending", text: "text-white" };
  }
  return { bg: "bg-brand", text: "text-white font-semibold" };
}

function EventChip({
  event,
  showPipelineTag,
  onClick,
}: {
  event: CalendarEvent;
  showPipelineTag: boolean;
  onClick: () => void;
}) {
  const { bg, text } = eventStyle(event);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate ${bg} ${text}`}
      title={`${event.time} ${event.oppName}`}
    >
      {showPipelineTag && (
        <span className="opacity-70 mr-0.5">{PIPELINE_TAG[event.pipeline]}</span>
      )}
      {event.time}
    </button>
  );
}

function DetailBadge({ event }: { event: CalendarEvent }) {
  const dq =
    event.kind === "bid_due" &&
    isDisqualified({ ...event.opp, bids: event.bids } as OppWithBids);
  if (dq) return <span className="text-[10px] font-bold text-dq bg-dq-bg border border-dq-border px-1.5 py-0.5 rounded">DQ</span>;
  if (event.kind === "walk" && event.mandatory) return <span className="text-[10px] font-medium text-white bg-orange-500 px-1.5 py-0.5 rounded">Mandatory</span>;
  if (event.kind === "walk") return <span className="text-[10px] font-medium text-white bg-pending px-1.5 py-0.5 rounded">Optional</span>;
  return <span className="text-[10px] font-medium text-white bg-brand px-1.5 py-0.5 rounded">Bid Due</span>;
}

// ── Mobile agenda view ──

function AgendaView({
  events,
  filter,
  navigate,
}: {
  events: CalendarEvent[];
  filter: Pipeline | "ALL";
  navigate: (path: string) => void;
}) {
  const sorted = [...events].sort((a, b) => {
    const da = `${a.date}T${a.time}`;
    const db = `${b.date}T${b.time}`;
    return da.localeCompare(db);
  });

  const grouped: Record<string, CalendarEvent[]> = {};
  for (const e of sorted) (grouped[e.date] ??= []).push(e);
  const dates = Object.keys(grouped).sort();

  if (dates.length === 0) {
    return <p className="text-sm text-subtle text-center py-8">No events this month</p>;
  }

  return (
    <div className="space-y-3">
      {dates.map((date) => (
        <div key={date}>
          <h3 className="text-xs font-semibold text-label uppercase tracking-wide mb-1.5">
            {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
              weekday: "short", month: "short", day: "numeric",
            })}
          </h3>
          <div className="space-y-1.5">
            {grouped[date].map((e) => {
              const dq =
                e.kind === "bid_due" &&
                isDisqualified({ ...e.opp, bids: e.bids } as OppWithBids);
              return (
                <button
                  key={e.id}
                  onClick={() => navigate(`/opp/${e.oppId}`)}
                  className="w-full text-left rounded-lg border border-card-border p-3 active:bg-gray-50 flex items-center gap-3"
                >
                  <DetailBadge event={e} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${dq ? "text-dq line-through" : "text-heading"}`}>
                      {e.time} — {e.oppName}
                    </p>
                    <p className="text-xs text-label truncate">
                      {e.companyName ?? "—"}
                      {filter === "ALL" && <span className="text-subtle ml-1">({PIPELINE_TAG[e.pipeline]})</span>}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ──

export default function BidCalendarPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [filter, setFilter] = useState<Pipeline | "ALL">("ALL");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const { events, loading } = useCalendarEvents(year, month, filter);

  const cells = buildGrid(year, month);
  const rows = cells.length / 7;
  const todayStr = now.toISOString().slice(0, 10);
  const showTag = filter === "ALL";

  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const e of events) (eventsByDate[e.date] ??= []).push(e);

  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); setSelectedDay(null); };
  const goPrev = () => { if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1); setSelectedDay(null); };
  const goNext = () => { if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1); setSelectedDay(null); };

  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null;
  const selectedEvents = selectedDateStr ? (eventsByDate[selectedDateStr] ?? []) : [];

  return (
    <div className="pb-16 md:pb-6">
      <h1 className="text-xl font-bold text-white mb-4">Bid Calendar</h1>

      <div className="bg-card rounded-xl shadow-sm p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={goPrev} className="text-label px-2 py-1 active:bg-gray-100 rounded">&lsaquo;</button>
            <h2 className="text-lg font-bold text-heading">{MONTH_NAMES[month]} {year}</h2>
            <button onClick={goNext} className="text-label px-2 py-1 active:bg-gray-100 rounded">&rsaquo;</button>
          </div>
          <button onClick={goToday} className="text-xs text-brand font-medium">Today</button>
        </div>

        {/* Pipeline filter */}
        <div className="flex gap-1 mb-2 overflow-x-auto">
          {FILTER_OPTIONS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap
                ${filter === f.value ? "bg-brand text-white" : "bg-gray-100 text-label active:bg-gray-200"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mb-3 text-[10px] text-label">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand" />Bid Due</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />Walk (mandatory)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pending" />Walk (optional)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-dq" />Disqualified</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          </div>
        ) : (
          <>
            {/* Desktop: month grid */}
            <div className="hidden md:block flex-1">
              <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200"
                   style={{ gridTemplateRows: `auto repeat(${rows}, 1fr)` }}>
                {DAYS.map((d) => (
                  <div key={d} className="bg-gray-50 text-center text-xs font-medium text-label py-1.5">{d}</div>
                ))}
                {cells.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} className="bg-white" />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayEvents = eventsByDate[dateStr] ?? [];
                  const isToday = dateStr === todayStr;
                  const isSelected = day === selectedDay;
                  return (
                    <button key={day}
                      onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                      className={`bg-white p-1 text-left align-top min-h-[72px]
                        ${isSelected ? "ring-2 ring-brand ring-inset" : ""}
                        ${isToday ? "bg-brand/5" : ""}`}>
                      <span className={`text-xs block mb-0.5 ${isToday ? "font-bold text-brand" : "text-label"}`}>{day}</span>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => (
                          <EventChip key={e.id} event={e} showPipelineTag={showTag} onClick={() => navigate(`/opp/${e.oppId}`)} />
                        ))}
                        {dayEvents.length > 3 && <span className="text-[10px] text-subtle">+{dayEvents.length - 3}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected day detail */}
              {selectedDateStr && (
                <div className="mt-3 rounded-lg border border-card-border p-3">
                  <h3 className="text-sm font-semibold text-heading mb-2">
                    {new Date(year, month, selectedDay!).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                  </h3>
                  {selectedEvents.length === 0 ? (
                    <p className="text-sm text-subtle">No events</p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedEvents.map((e) => {
                        const dq = e.kind === "bid_due" && isDisqualified({ ...e.opp, bids: e.bids } as OppWithBids);
                        return (
                          <li key={e.id}>
                            <button onClick={() => navigate(`/opp/${e.oppId}`)} className="w-full text-left active:bg-gray-50 rounded-lg p-2 flex items-center gap-2">
                              <DetailBadge event={e} />
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-medium ${dq ? "text-dq line-through" : "text-heading"}`}>{e.time} — {e.oppName}</p>
                                <p className="text-xs text-subtle">
                                  {e.companyName ?? "—"}
                                  {showTag && <span className="ml-1">({PIPELINE_TAG[e.pipeline]})</span>}
                                </p>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Mobile: agenda list */}
            <div className="md:hidden">
              <AgendaView events={events} filter={filter} navigate={(p) => navigate(p)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
