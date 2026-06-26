import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type ContactRole = Database["public"]["Enums"]["contact_role"];

export interface ContactWithCompany extends ContactRow {
  company_name: string | null;
}

export function useContactList(includeArchived = false) {
  const [contacts, setContacts] = useState<ContactWithCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    let q = supabase.from("contacts").select("*, companies(name)").order("name");
    if (!includeArchived) q = q.is("archived_at", null);
    const { data } = await q;

    setContacts(
      (data ?? []).map((c) => ({
        ...c,
        company_name: (c.companies as { name: string } | null)?.name ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createContact = async (input: {
    company_id: string;
    name: string;
    role: ContactRole;
    phone: string;
    email?: string;
    is_decision_maker?: boolean;
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

  return { contacts, loading, createContact, archiveContact, unarchiveContact, refetch: fetch };
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

  return { data, loading, error, refetch: fetch };
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
