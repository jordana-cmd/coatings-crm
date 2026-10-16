import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { Bot } from "lucide-react";
import KpiCard from "../components/dashboard/KpiCard";
import { usePricingIntel, median, type PricePointRow } from "../hooks/usePricingIntel";

const fmt$ = (n: number) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const pct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;

const SOURCE_LABEL: Record<string, string> = {
  MCFC_ESTIMATE: "Our estimates",
  SUB_QUOTE: "Sub quotes",
  WINNING_BID: "Winning bids",
  COMPETITOR_BID: "Other bids",
};
// Distinct hues that hold up in light and dark themes; never the only cue (legend + tooltip name the series).
const SOURCE_COLOR: Record<string, string> = {
  MCFC_ESTIMATE: "#CC0000",
  SUB_QUOTE: "#2563EB",
  WINNING_BID: "#059669",
  COMPETITOR_BID: "#9CA3AF",
};
const SYSTEMS = ["all", "flake", "epoxy", "polish", "sealer", "urethane_cement", "quartz", "other"] as const;

function Card({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-heading mb-0.5">{title}</h3>
          {subtitle && <p className="text-[10px] text-subtle mb-4">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-48 flex items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
    </div>
  );
}

function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: PricePointRow }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-heading">{p.opportunity_name}</p>
      <p className="text-label">
        {SOURCE_LABEL[p.source ?? ""] ?? p.source} · {p.party}
      </p>
      <p className="text-label">
        {p.system ?? "system ?"} · {Number(p.square_feet).toLocaleString()} SF · {fmt$(Number(p.amount))}
      </p>
      <p className="font-semibold text-heading">${Number(p.price_per_sf).toFixed(2)}/SF</p>
    </div>
  );
}

export default function PricingIntelPage() {
  const navigate = useNavigate();
  const { data, loading, error } = usePricingIntel();
  const [system, setSystem] = useState<(typeof SYSTEMS)[number]>("all");

  const points = useMemo(
    () =>
      (data?.pricePoints ?? []).filter(
        (p) => p.square_feet && p.price_per_sf && (system === "all" || p.system === system)
      ),
    [data, system]
  );
  const bySource = useMemo(() => {
    const g: Record<string, PricePointRow[]> = {};
    for (const p of points) (g[p.source ?? "?"] ||= []).push(p);
    return g;
  }, [points]);

  const medianTable = useMemo(() => {
    const rows: { system: string; source: string; n: number; med: number }[] = [];
    const g: Record<string, number[]> = {};
    for (const p of data?.pricePoints ?? []) {
      if (!p.price_per_sf || !p.system) continue;
      (g[`${p.system}|${p.source}`] ||= []).push(Number(p.price_per_sf));
    }
    for (const [k, v] of Object.entries(g)) {
      const [sys, src] = k.split("|");
      rows.push({ system: sys, source: src, n: v.length, med: median(v) ?? 0 });
    }
    return rows.sort((a, b) => a.system.localeCompare(b.system) || a.source.localeCompare(b.source));
  }, [data]);

  if (loading) return <Spinner />;
  if (error && !data)
    return <p className="text-sm text-dq">Couldn't load pricing data: {error}</p>;

  const ptw = data?.priceToWin ?? [];
  const medOver = median(ptw.map((r) => r.pctOver));
  const { won = 0, lost = 0 } = data?.decided90 ?? {};
  const winRate = won + lost ? won / (won + lost) : null;

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-heading">Pricing intel</h1>
          <p className="text-xs text-subtle">What we bid, what subs quote, and what actually wins.</p>
        </div>
        <button
          onClick={() => navigate("/agents")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-label hover:text-heading"
        >
          <Bot size={14} /> Agent runs
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Win rate (90 days)"
          value={winRate == null ? "—" : `${Math.round(winRate * 100)}%`}
          subLabel={`${won} won / ${lost} lost`}
          ring={winRate}
        />
        <KpiCard
          label="Over the winner"
          value={medOver == null ? "—" : pct(medOver)}
          subLabel={`median, ${ptw.length} losses with a known winner`}
        />
        <KpiCard label="Sub quotes on file" value={String(data?.subQuoteCount ?? 0)} subLabel="MSC + others" />
        <KpiCard label="$/SF data points" value={String(data?.pricePoints.length ?? 0)} subLabel="estimates + sub quotes with SF" />
      </div>

      <Card
        title="Price to win"
        subtitle="Losses where we know the winning number. The bid results chaser adds these every Thursday."
      >
        {ptw.length === 0 ? (
          <p className="text-sm text-subtle py-4 text-center">No winning numbers recorded yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-label text-left">
                  <th className="px-1 py-1.5 font-medium">Job</th>
                  <th className="px-1 py-1.5 font-medium text-right">Ours</th>
                  <th className="px-1 py-1.5 font-medium text-right">Winner</th>
                  <th className="px-1 py-1.5 font-medium text-right">Over</th>
                </tr>
              </thead>
              <tbody>
                {ptw.map((r) => (
                  <tr
                    key={r.opportunityId + r.winnerName}
                    onClick={() => navigate(`/opp/${r.opportunityId}`)}
                    className="border-t border-card-border cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-1 py-2">
                      <p className="text-heading truncate max-w-[16rem]">{r.name}</p>
                      <p className="text-[10px] text-subtle">
                        {r.winnerName}
                        {r.lostReason ? ` · ${r.lostReason}` : ""}
                      </p>
                    </td>
                    <td className="px-1 py-2 text-right text-heading">{fmt$(r.ourAmount)}</td>
                    <td className="px-1 py-2 text-right text-heading">{fmt$(r.winnerAmount)}</td>
                    <td className={`px-1 py-2 text-right font-semibold ${r.pctOver > 0.15 ? "text-dq" : "text-heading"}`}>
                      {pct(r.pctOver)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="$/SF by job size"
        subtitle="Each dot is a priced job. Hover for details."
        right={
          <select
            value={system}
            onChange={(e) => setSystem(e.target.value as (typeof SYSTEMS)[number])}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-heading"
            aria-label="Filter by system"
          >
            {SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All systems" : s.replace("_", " ")}
              </option>
            ))}
          </select>
        }
      >
        {points.length === 0 ? (
          <p className="text-sm text-subtle py-8 text-center">No priced jobs with square footage for this system yet.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100" />
                <XAxis
                  type="number"
                  dataKey="square_feet"
                  name="SF"
                  scale="log"
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="price_per_sf"
                  name="$/SF"
                  tickFormatter={(v: number) => `$${v}`}
                  tick={{ fontSize: 10 }}
                  width={40}
                />
                <ZAxis range={[40, 40]} />
                <Tooltip content={<PointTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {Object.entries(bySource).map(([src, pts]) => (
                  <Scatter key={src} name={SOURCE_LABEL[src] ?? src} data={pts} fill={SOURCE_COLOR[src] ?? "#6B7280"} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Median $/SF by system" subtitle="Across every estimate and sub quote with square footage.">
          {medianTable.length === 0 ? (
            <p className="text-sm text-subtle py-4 text-center">No data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {medianTable.map((r) => (
                  <tr key={r.system + r.source} className="border-t border-card-border first:border-0">
                    <td className="py-1.5 text-heading">{r.system.replace("_", " ")}</td>
                    <td className="py-1.5 text-label text-xs">{SOURCE_LABEL[r.source] ?? r.source}</td>
                    <td className="py-1.5 text-right text-subtle text-xs">n={r.n}</td>
                    <td className="py-1.5 text-right font-semibold text-heading">${r.med.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Pricing rules in force" subtitle="Set from Jake's job costing sheets, Oct 2026. The pricing skill applies these.">
          <ul className="space-y-2 text-sm text-heading">
            <li><span className="font-semibold">$68.04</span> overhead per man-hour (since May 2026; was $52.99)</li>
            <li><span className="font-semibold">1.45×</span> quoted hours on commercial work: actual labor runs a median 1.45–1.49× the estimate</li>
            <li><span className="font-semibold">15 / 18 SF per MH</span> real flake output under 5k / 5–20k SF</li>
            <li><span className="font-semibold">~80%</span> of commercial job cost is labor + overhead</li>
            <li>Residential estimates track actuals (0.98×), so no hours factor there</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
