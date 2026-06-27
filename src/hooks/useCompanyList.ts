import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type CompanyType = Database["public"]["Enums"]["company_type"];

export interface CompanyListItem {
  id: string;
  name: string;
  type: CompanyType;
  region: string;
  address: string;
  website: string | null;
  notes: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  last_activity_at: string | null;
  jobs_out_for_bid: number;
  opp_count: number;
  location: string;
  on_bid_list: boolean;
  planroom_url: string | null;
}

function buildLocation(city: string | null, state: string | null, region: string): string {
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  if (region) return region;
  return "—";
}

export function useCompanyList(includeArchived = false) {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);

    let q = supabase.from("v_company_list").select("*").order("name");
    if (!includeArchived) q = q.is("archived_at", null);
    const { data } = await q;

    setCompanies(
      (data ?? []).map((c) => ({
        id: c.id!,
        name: c.name!,
        type: c.type! as CompanyType,
        region: c.region!,
        address: c.address!,
        website: c.website ?? null,
        notes: c.notes ?? null,
        city: c.city ?? null,
        state: c.state ?? null,
        created_at: c.created_at!,
        last_activity_at: c.last_activity_at ?? null,
        jobs_out_for_bid: Number(c.jobs_out_for_bid ?? 0),
        opp_count: Number(c.opp_count ?? 0),
        location: buildLocation(c.city ?? null, c.state ?? null, c.region!),
        on_bid_list: c.on_bid_list ?? false,
        planroom_url: c.planroom_url ?? null,
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
    city?: string;
    state?: string;
  }) => {
    if (!supabase) return { error: "Not configured" };
    const { error } = await supabase.from("companies").insert(input);
    if (error) return { error: error.message };
    await fetch();
    return { error: null };
  };

  const archiveCompany = async (id: string) => {
    if (!supabase) return;
    await supabase.from("companies").update({ archived_at: new Date().toISOString() }).eq("id", id);
    await fetch();
  };

  const unarchiveCompany = async (id: string) => {
    if (!supabase) return;
    await supabase.from("companies").update({ archived_at: null }).eq("id", id);
    await fetch();
  };

  return { companies, loading, createCompany, archiveCompany, unarchiveCompany, refetch: fetch };
}
