import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Opp = Database["public"]["Tables"]["opportunities"]["Row"] & {
  company_name: string | null;
};

type Company = Database["public"]["Tables"]["companies"]["Row"];
type CompanyType = Database["public"]["Enums"]["company_type"];

export function useOpportunities() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpps = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("opportunities")
      .select("*, companies(name)")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setOpps(
        (data ?? []).map((row) => ({
          ...row,
          company_name: (row.companies as { name: string } | null)?.name ?? null,
        }))
      );
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOpps();
  }, [fetchOpps]);

  const create = async (input: {
    name: string;
    company_id: string;
    job_site_address: string;
    amount?: number | null;
  }) => {
    if (!supabase) return { error: "Supabase not configured" };
    const { error: err } = await supabase.rpc("create_opportunity", {
      p_name: input.name,
      p_pipeline: "PUBLIC_BID",
      p_company_id: input.company_id,
      p_job_site_address: input.job_site_address,
      p_amount: input.amount ?? undefined,
    });
    if (err) return { error: err.message };
    await fetchOpps();
    return { error: null };
  };

  const deleteOpportunity = async (id: string) => {
    if (!supabase) return { error: "Not configured" };
    const { error: err } = await supabase.rpc("delete_opportunity", { p_opp_id: id });
    if (err) return { error: err.message };
    await fetchOpps();
    return { error: null };
  };

  return { opps, loading, error, create, deleteOpportunity, refetch: fetchOpps };
}

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("*")
      .order("name");
    setCompanies(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const createCompany = async (input: {
    name: string;
    type: CompanyType;
    region: string;
    address: string;
  }) => {
    if (!supabase) return { data: null, error: "Supabase not configured" };
    const { data, error } = await supabase
      .from("companies")
      .insert(input)
      .select()
      .single();
    if (!error) await fetchCompanies();
    return { data, error: error?.message ?? null };
  };

  return { companies, loading, createCompany, refetch: fetchCompanies };
}
