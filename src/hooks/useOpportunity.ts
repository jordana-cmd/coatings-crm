import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { OppRow, BidsRow, FacilityRow, FederalRow } from "../lib/gates/types";

export type OppDetailData = OppRow & {
  bids: BidsRow | null;
  facility_details: FacilityRow | null;
  federal_details: FederalRow | null;
  company_name: string | null;
};

/** Which extension row each pipeline requires (extension-row existence rule). */
function requiredExtension(pipeline: string): "bids" | "facility_details" | "federal_details" {
  if (pipeline === "FACILITY") return "facility_details";
  if (pipeline === "FEDERAL") return "federal_details";
  return "bids";
}

function unwrap<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function useOpportunity(id: string | undefined) {
  const [data, setData] = useState<OppDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase || !id) return;
    setLoading(true);

    const { data: opp, error: err } = await supabase
      .from("opportunities")
      .select("*, bids(*), facility_details(*), federal_details(*), companies(name)")
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

    // Supabase returns 1:1 extension rows as arrays (unique FK) — unwrap
    const result: OppDetailData = {
      ...opp,
      bids: unwrap(opp.bids as BidsRow | BidsRow[] | null),
      facility_details: unwrap(opp.facility_details as FacilityRow | FacilityRow[] | null),
      federal_details: unwrap(opp.federal_details as FederalRow | FederalRow[] | null),
      company_name: (opp.companies as { name: string } | null)?.name ?? null,
    } as OppDetailData;

    const required = requiredExtension(result.pipeline);
    if (!result[required]) {
      setError(`${required} extension row missing`);
      setLoading(false);
      return;
    }

    setData(result);
    setError(null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
