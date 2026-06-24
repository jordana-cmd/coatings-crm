import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface DashboardData {
  outstandingBid: { total: number; count: number };
  winRates: { pipeline: string; wins: number; decided: number; rate: number | null }[];
  spreadToLow: { avg: number | null; sampleSize: number };
  bondExposure: { pct: number; bondedDollars: number; totalDollars: number };
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);

    const [bidRes, winRes, spreadRes, bondRes] = await Promise.all([
      supabase.from("v_outstanding_bid_dollars").select("*"),
      supabase.from("v_win_rate_by_motion").select("*"),
      supabase.from("v_spread_to_low").select("*").single(),
      supabase.from("v_bond_exposure").select("*").single(),
    ]);

    const bidRows = bidRes.data ?? [];
    const totalBid = bidRows.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const totalCount = bidRows.reduce((s, r) => s + Number(r.opp_count ?? 0), 0);

    const winRates = (winRes.data ?? []).map((r) => ({
      pipeline: r.pipeline ?? "",
      wins: Number(r.wins ?? 0),
      decided: Number(r.decided ?? 0),
      rate: r.win_rate != null ? Number(r.win_rate) : null,
    }));

    setData({
      outstandingBid: { total: totalBid, count: totalCount },
      winRates,
      spreadToLow: {
        avg: spreadRes.data?.avg_spread != null ? Number(spreadRes.data.avg_spread) : null,
        sampleSize: Number(spreadRes.data?.sample_size ?? 0),
      },
      bondExposure: {
        pct: Number(bondRes.data?.bond_pct ?? 0),
        bondedDollars: Number(bondRes.data?.bonded_dollars ?? 0),
        totalDollars: Number(bondRes.data?.total_dollars ?? 0),
      },
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading };
}
