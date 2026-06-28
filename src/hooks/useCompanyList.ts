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

export interface CompanyFilters {
  type: CompanyType | "ALL";
  search: string;
  includeArchived: boolean;
}

function buildLocation(city: string | null, state: string | null, region: string): string {
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  if (region) return region;
  return "—";
}

/** Build a filtered query (single source of truth for filter+search). */
function buildCompanyQuery(filters: CompanyFilters) {
  if (!supabase) return null;
  let q = supabase.from("v_company_list").select("*", { count: "exact" }).order("name");
  if (!filters.includeArchived) q = q.is("archived_at", null);
  if (filters.type !== "ALL") q = q.eq("type", filters.type);
  if (filters.search) q = q.ilike("name", `%${filters.search}%`);
  return q;
}

function mapRow(c: Record<string, unknown>): CompanyListItem {
  return {
    id: c.id as string,
    name: c.name as string,
    type: c.type as CompanyType,
    region: c.region as string,
    address: c.address as string,
    website: (c.website as string) ?? null,
    notes: (c.notes as string) ?? null,
    city: (c.city as string) ?? null,
    state: (c.state as string) ?? null,
    created_at: c.created_at as string,
    last_activity_at: (c.last_activity_at as string) ?? null,
    jobs_out_for_bid: Number(c.jobs_out_for_bid ?? 0),
    opp_count: Number(c.opp_count ?? 0),
    location: buildLocation((c.city as string) ?? null, (c.state as string) ?? null, c.region as string),
    on_bid_list: (c.on_bid_list as boolean) ?? false,
    planroom_url: (c.planroom_url as string) ?? null,
  };
}

export function useCompanyList(filters: CompanyFilters, page: number, pageSize: number) {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const q = buildCompanyQuery(filters);
    if (!q) return;
    setLoading(true);
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, count } = await q.range(from, to);
    setCompanies((data ?? []).map(mapRow));
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [filters.type, filters.search, filters.includeArchived, page, pageSize]);

  useEffect(() => { fetch(); }, [fetch]);

  const createCompany = async (input: {
    name: string; type: CompanyType; region: string; address: string; city?: string; state?: string;
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

  return { companies, totalCount, loading, createCompany, archiveCompany, unarchiveCompany, refetch: fetch };
}

/** Fetch ALL rows matching the current filters (no pagination). For future export. */
export async function fetchAllFilteredCompanies(filters: CompanyFilters): Promise<CompanyListItem[]> {
  const q = buildCompanyQuery(filters);
  if (!q) return [];
  const { data } = await q;
  return (data ?? []).map(mapRow);
}
