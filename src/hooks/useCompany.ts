import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type OppRow = Database["public"]["Tables"]["opportunities"]["Row"];
type ContactRole = Database["public"]["Enums"]["contact_role"];

export interface CompanyDetail {
  company: CompanyRow;
  contacts: ContactRow[];
  opportunities: OppRow[];
}

export function useCompany(id: string | undefined) {
  const [data, setData] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase || !id) return;
    setLoading(true);

    const [compRes, conRes, oppRes] = await Promise.all([
      supabase.from("companies").select("*").eq("id", id).single(),
      supabase.from("contacts").select("*").eq("company_id", id).order("name"),
      supabase.from("opportunities").select("*").eq("company_id", id).order("created_at", { ascending: false }),
    ]);

    if (compRes.error) {
      setError(compRes.error.message);
      setLoading(false);
      return;
    }

    setData({
      company: compRes.data,
      contacts: conRes.data ?? [],
      opportunities: oppRes.data ?? [],
    });
    setError(null);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateNotes = async (notes: string) => {
    if (!supabase || !id) return;
    await supabase.from("companies").update({ notes }).eq("id", id);
    await fetch();
  };

  const updateCompany = async (fields: Partial<CompanyRow>) => {
    if (!supabase || !id) return;
    await supabase.from("companies").update(fields).eq("id", id);
    await fetch();
  };

  const addContact = async (input: {
    name: string;
    role: ContactRole;
    phone: string;
    email?: string;
    is_decision_maker?: boolean;
  }) => {
    if (!supabase || !id) return { error: "Not ready" };
    const { error: err } = await supabase.from("contacts").insert({
      company_id: id,
      ...input,
    });
    if (err) return { error: err.message };
    await fetch();
    return { error: null };
  };

  return { data, loading, error, refetch: fetch, updateNotes, updateCompany, addContact };
}
