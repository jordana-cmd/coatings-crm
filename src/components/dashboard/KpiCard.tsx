import type { ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  subLabel?: string;
  badge?: ReactNode;
}

export default function KpiCard({ label, value, subLabel, badge }: Props) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-5 flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-label uppercase tracking-wide">{label}</span>
        {badge && <span>{badge}</span>}
      </div>
      <p className="text-2xl font-bold text-heading truncate">{value}</p>
      {subLabel && <p className="text-xs text-label">{subLabel}</p>}
    </div>
  );
}
