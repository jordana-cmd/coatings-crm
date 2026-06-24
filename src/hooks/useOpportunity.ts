import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { OppWithBids } from "../lib/gates/types";

type OppDetail = OppWithBids & { company_name: string | null };

export function useOpportunity(id: string | undefined) {
  const [data, setData] = useState<OppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase || !id) return;
    setLoading(true);

    const { data: opp, error: err } = await supabase
      .from("opportunities")
      .select("*, bids(*), companies(name)")
      .eq("id", id)
      .single();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (!opp) {
      setError("Opportunity not found");
      setLoading(false);
      return;
    }

    // Supabase returns bids as an array (1:1 via unique FK) — unwrap
    const bidsRow = Array.isArray(opp.bids) ? opp.bids[0] : opp.bids;
    const companyName = (opp.companies as { name: string } | null)?.name ?? null;

    if (!bidsRow) {
      setError("Bids extension row missing");
      setLoading(false);
      return;
    }

    setData({
      ...opp,
      bids: bidsRow,
      company_name: companyName,
    } as OppDetail);
    setError(null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
