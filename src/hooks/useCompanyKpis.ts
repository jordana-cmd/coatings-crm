import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface CompanyKpis {
  totalBidDollars: number;
  totalWonDollars: number;
  avgBidSize: number | null;
  winRateCount: number | null;
  winRatePublicBid: number | null;
  winRateGcChase: number | null;
  winRateFacility: number | null;
  wonCount: number;
  decidedCount: number;
}

export function useCompanyKpis(companyId: string | undefined) {
  const [kpis, setKpis] = useState<CompanyKpis | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!supabase || !companyId) return;
    setLoading(true);

    const { data } = await supabase
      .from("v_company_kpis")
      .select("*")
      .eq("company_id", companyId)
      .single();

    if (data) {
      setKpis({
        totalBidDollars: Number(data.total_bid_dollars ?? 0),
        totalWonDollars: Number(data.total_won_dollars ?? 0),
        avgBidSize: data.avg_bid_size != null ? Number(data.avg_bid_size) : null,
        winRateCount: data.win_rate_count != null ? Number(data.win_rate_count) : null,
        winRatePublicBid: data.win_rate_public_bid != null ? Number(data.win_rate_public_bid) : null,
        winRateGcChase: data.win_rate_gc_chase != null ? Number(data.win_rate_gc_chase) : null,
        winRateFacility: data.win_rate_facility != null ? Number(data.win_rate_facility) : null,
        wonCount: Number(data.won_count ?? 0),
        decidedCount: Number(data.decided_count ?? 0),
      });
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { kpis, loading };
}
