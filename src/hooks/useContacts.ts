import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type ContactRole = Database["public"]["Enums"]["contact_role"];

export interface ContactWithCompany extends ContactRow {
  company_name: string | null;
}

export type LastContactedFilter = "ANY" | "7D" | "30D" | "90PLUS" | "NEVER";

export interface ContactFilters {
  role: ContactRole | "ALL";
  search: string;
  includeArchived: boolean;
  lastContacted: LastContactedFilter;
}

function mapContactRow(c: Record<string, unknown>): ContactWithCompany {
  return {
    ...(c as ContactRow),
    company_name: (c.companies as { name: string } | null)?.name ?? null,
  };
}

/** Build the filtered query (single source of truth). Async because of company-name search lookup. */
async function fetchContacts(filters: ContactFilters, rangeFrom?: number, rangeTo?: number) {
  if (!supabase) return { data: null, count: 0 };

  // If searching, find matching company IDs first so we can OR with name/title matches
  let companyIds: string[] | null = null;
  if (filters.search) {
    const { data: cos } = await supabase
      .from("companies").select("id").ilike("name", `%${filters.search}%`);
    companyIds = (cos ?? []).map((c) => c.id);
  }

  let q = supabase.from("contacts").select("*, companies(name)", { count: "exact" }).order("name");
  if (!filters.includeArchived) q = q.is("archived_at", null);
  if (filters.role !== "ALL") q = q.eq("role", filters.role);

  if (filters.search) {
    if (companyIds && companyIds.length > 0) {
      q = q.or(`name.ilike.%${filters.search}%,title.ilike.%${filters.search}%,company_id.in.(${companyIds.join(",")})`);
    } else {
      q = q.or(`name.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);
    }
  }

  // Last-contacted filter
  if (filters.lastContacted !== "ANY") {
    const now = new Date();
    if (filters.lastContacted === "NEVER") {
      q = q.is("last_contacted_at", null);
    } else if (filters.lastContacted === "7D") {
      q = q.gte("last_contacted_at", new Date(now.getTime() - 7 * 86400000).toISOString());
    } else if (filters.lastContacted === "30D") {
      q = q.gte("last_contacted_at", new Date(now.getTime() - 30 * 86400000).toISOString());
    } else if (filters.lastContacted === "90PLUS") {
      q = q.lte("last_contacted_at", new Date(now.getTime() - 90 * 86400000).toISOString());
    }
  }

  if (rangeFrom != null && rangeTo != null) q = q.range(rangeFrom, rangeTo);

  return q;
}

export function useContactList(filters: ContactFilters, page: number, pageSize: number) {
  const [contacts, setContacts] = useState<ContactWithCompany[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, count } = await fetchContacts(filters, from, to);
    setContacts((data ?? []).map(mapContactRow));
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [filters.role, filters.search, filters.includeArchived, filters.lastContacted, page, pageSize]);

  useEffect(() => { fetch(); }, [fetch]);

  const createContact = async (input: {
    company_id: string; name: string; role: ContactRole; phone: string;
    email?: string; is_decision_maker?: boolean;
  }) => {
    if (!supabase) return { error: "Not configured" };
    const { error } = await supabase.from("contacts").insert(input);
    if (error) return { error: error.message };
    await fetch();
    return { error: null };
  };

  const archiveContact = async (id: string) => {
    if (!supabase) return;
    await supabase.from("contacts").update({ archived_at: new Date().toISOString() }).eq("id", id);
    await fetch();
  };

  const unarchiveContact = async (id: string) => {
    if (!supabase) return;
    await supabase.from("contacts").update({ archived_at: null }).eq("id", id);
    await fetch();
  };

  const toggleFavorite = async (id: string, value: boolean) => {
    if (!supabase) return;
    await supabase.from("contacts").update({ is_favorite: value }).eq("id", id);
    await fetch();
  };

  return { contacts, totalCount, loading, createContact, archiveContact, unarchiveContact, toggleFavorite, refetch: fetch };
}

/** Fetch ALL contacts matching the current filters (no pagination). For future export. */
export async function fetchAllFilteredContacts(filters: ContactFilters): Promise<ContactWithCompany[]> {
  const { data } = await fetchContacts(filters);
  return (data ?? []).map(mapContactRow);
}

export interface ContactDetail {
  contact: ContactRow;
  company_name: string | null;
  company_id: string;
}

export function useContact(id: string | undefined) {
  const [data, setData] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase || !id) return;
    setLoading(true);
    const { data: row, error: err } = await supabase
      .from("contacts")
      .select("*, companies(name)")
      .eq("id", id)
      .single();

    if (err || !row) {
      setError(err?.message ?? "Not found");
      setLoading(false);
      return;
    }

    setData({
      contact: row,
      company_name: (row.companies as { name: string } | null)?.name ?? null,
      company_id: row.company_id,
    });
    setError(null);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateContact = async (fields: Partial<ContactRow>) => {
    if (!supabase || !id) return;
    await supabase.from("contacts").update(fields).eq("id", id);
    await fetch();
  };

  return { data, loading, error, refetch: fetch, updateContact };
}

export interface ContactActivity {
  id: string;
  type: string;
  note: string | null;
  logged_at: string;
  opp_id: string;
  opp_name: string;
  direct: boolean; // true = contact_id matches, false = company-job fallback
}

export function useContactActivities(contactId: string | undefined, companyId: string | undefined) {
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!supabase || !contactId || !companyId) return;
    setLoading(true);

    // Direct: activities logged to this contact
    const { data: direct } = await supabase
      .from("activities")
      .select("id, type, note, logged_at, opportunity_id, opportunities(name)")
      .eq("contact_id", contactId)
      .order("logged_at", { ascending: false });

    // Company-job: activities on opps belonging to this contact's company
    const { data: companyOpps } = await supabase
      .from("opportunities")
      .select("id")
      .eq("company_id", companyId);

    const oppIds = (companyOpps ?? []).map((o) => o.id);

    let companyActs: typeof direct = [];
    if (oppIds.length > 0) {
      const { data } = await supabase
        .from("activities")
        .select("id, type, note, logged_at, opportunity_id, opportunities(name)")
        .in("opportunity_id", oppIds)
        .order("logged_at", { ascending: false })
        .limit(50);
      companyActs = data;
    }

    // Merge + dedup
    const seen = new Set<string>();
    const merged: ContactActivity[] = [];

    for (const a of direct ?? []) {
      seen.add(a.id);
      merged.push({
        id: a.id,
        type: a.type,
        note: a.note,
        logged_at: a.logged_at,
        opp_id: a.opportunity_id,
        opp_name: (a.opportunities as { name: string } | null)?.name ?? "—",
        direct: true,
      });
    }

    for (const a of companyActs ?? []) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      merged.push({
        id: a.id,
        type: a.type,
        note: a.note,
        logged_at: a.logged_at,
        opp_id: a.opportunity_id,
        opp_name: (a.opportunities as { name: string } | null)?.name ?? "—",
        direct: false,
      });
    }

    merged.sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    setActivities(merged);
    setLoading(false);
  }, [contactId, companyId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { activities, loading };
}

export function useCompanyContacts(companyId: string | undefined) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  useEffect(() => {
    if (!supabase || !companyId) return;
    supabase
      .from("contacts")
      .select("*")
      .eq("company_id", companyId)
      .order("name")
      .then(({ data }) => setContacts(data ?? []));
  }, [companyId]);

  return contacts;
}
