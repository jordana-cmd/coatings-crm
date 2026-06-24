import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type CompanyType = Database["public"]["Enums"]["company_type"];

export interface CompanyWithCount extends CompanyRow {
  opp_count: number;
}

export function useCompanyList() {
  const [companies, setCompanies] = useState<CompanyWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);

    const { data: comps } = await supabase
      .from("companies")
      .select("*, opportunities(id)")
      .order("name");

    setCompanies(
      (comps ?? []).map((c) => ({
        ...c,
        opp_count: Array.isArray(c.opportunities) ? c.opportunities.length : 0,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createCompany = async (input: {
    name: string;
    type: CompanyType;
    region: string;
    address: string;
  }) => {
    if (!supabase) return { error: "Not configured" };
    const { error } = await supabase.from("companies").insert(input);
    if (error) return { error: error.message };
    await fetch();
    return { error: null };
  };

  return { companies, loading, createCompany, refetch: fetch };
}
