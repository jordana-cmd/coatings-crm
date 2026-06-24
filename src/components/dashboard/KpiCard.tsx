import type { ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  subLabel?: string;
  badge?: ReactNode;
  /** 0–1 for a radial progress ring; omit for no ring */
  ring?: number | null;
}

function RadialRing({ value }: { value: number }) {
  const size = 48;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, value)));
  const pct = Math.round(value * 100);

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" strokeWidth={stroke} className="text-gray-100" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" strokeWidth={stroke} className="text-brand"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="fill-heading text-xs font-semibold">
        {pct}%
      </text>
    </svg>
  );
}

export default function KpiCard({ label, value, subLabel, badge, ring }: Props) {
  return (
    <div className="bg-card rounded-2xl p-5 flex items-center gap-4 min-w-0"
         style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
      {ring != null && ring > 0 && <RadialRing value={ring} />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] font-medium text-label uppercase tracking-wider">{label}</span>
          {badge && <span>{badge}</span>}
        </div>
        <p className="text-xl font-semibold text-heading truncate">{value}</p>
        {subLabel && <p className="text-[10px] text-subtle mt-0.5">{subLabel}</p>}
      </div>
    </div>
  );
}
