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
  { value: "PUBLIC_BID", label: "Public Bid" },
  { value: "GC_CHASE", label: "GC Chase" },
  { value: "FACILITY", label: "Facility" },
  { value: "ALL", label: "All" },
];

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

function EventDot({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const dq =
    event.kind === "bid_due" &&
    isDisqualified({ ...event.opp, bids: event.bids } as OppWithBids);

  let bg: string;
  if (dq) {
    bg = "bg-red-600";
  } else if (event.kind === "walk") {
    bg = event.mandatory ? "bg-red-400" : "bg-yellow-400";
  } else {
    bg = "bg-shell-light";
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate ${bg} text-white
                  ${dq ? "line-through opacity-75" : ""}`}
      title={`${event.time} ${event.oppName}`}
    >
      {event.time}
    </button>
  );
}

export default function BidCalendarPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [filter, setFilter] = useState<Pipeline | "ALL">("PUBLIC_BID");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const { events, loading } = useCalendarEvents(year, month, filter);

  const cells = buildGrid(year, month);
  const todayStr = now.toISOString().slice(0, 10);

  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    (eventsByDate[e.date] ??= []).push(e);
  }

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDay(null);
  };
  const goPrev = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
    setSelectedDay(null);
  };
  const goNext = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
    setSelectedDay(null);
  };

  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null;
  const selectedEvents = selectedDateStr ? (eventsByDate[selectedDateStr] ?? []) : [];

  return (
    <div className="pb-16 md:pb-6">
      <h1 className="text-xl font-bold text-white mb-4">Bid Calendar</h1>

      <div className="bg-card rounded-xl shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="text-label px-2 py-1 active:bg-gray-200 rounded">
            &lsaquo;
          </button>
          <h1 className="text-lg font-bold text-heading">
            {MONTH_NAMES[month]} {year}
          </h1>
          <button onClick={goNext} className="text-label px-2 py-1 active:bg-gray-200 rounded">
            &rsaquo;
          </button>
        </div>
        <button onClick={goToday} className="text-xs text-brand font-medium">
          Today
        </button>
      </div>

      {/* Pipeline filter */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap
              ${filter === f.value
                ? "bg-brand text-white"
                : "bg-gray-100 text-label active:bg-gray-200"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
            {DAYS.map((d) => (
              <div key={d} className="bg-gray-50 text-center text-xs font-medium text-label py-1.5">
                {d}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="bg-white min-h-[56px]" />;
              }
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayEvents = eventsByDate[dateStr] ?? [];
              const isToday = dateStr === todayStr;
              const isSelected = day === selectedDay;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`bg-white min-h-[56px] p-0.5 text-left align-top
                    ${isSelected ? "ring-2 ring-brand ring-inset" : ""}
                    ${isToday ? "bg-blue-50" : ""}`}
                >
                  <span className={`text-xs block mb-0.5 ${isToday ? "font-bold text-brand" : "text-label"}`}>
                    {day}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <EventDot key={e.id} event={e} onClick={() => navigate(`/opp/${e.oppId}`)} />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] text-subtle">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail panel for selected day */}
          {selectedDateStr && (
            <div className="mt-3 rounded-xl bg-white border border-gray-200 p-3">
              <h3 className="text-sm font-semibold text-heading mb-2">
                {new Date(year, month, selectedDay!).toLocaleDateString(undefined, {
                  weekday: "long", month: "short", day: "numeric",
                })}
              </h3>
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-subtle">No events</p>
              ) : (
                <ul className="space-y-2">
                  {selectedEvents.map((e) => {
                    const dq =
                      e.kind === "bid_due" &&
                      isDisqualified({ ...e.opp, bids: e.bids } as OppWithBids);
                    return (
                      <li key={e.id}>
                        <button
                          onClick={() => navigate(`/opp/${e.oppId}`)}
                          className="w-full text-left active:bg-gray-50 rounded-lg p-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              e.kind === "walk"
                                ? e.mandatory ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-heading"
                            }`}>
                              {e.kind === "walk" ? "Walk" : "Bid Due"}
                            </span>
                            <span className="text-sm font-medium text-heading">{e.time}</span>
                            {dq && (
                              <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                DQ
                              </span>
                            )}
                          </div>
                          <p className={`text-sm text-heading mt-0.5 ${dq ? "line-through" : ""}`}>
                            {e.oppName}
                          </p>
                          <p className="text-xs text-subtle">{e.companyName ?? "—"}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
