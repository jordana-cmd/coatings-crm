import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export type SearchResultType = "company" | "contact" | "opportunity";

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
}

export interface GlobalSearchResults {
  companies: SearchResultItem[];
  contacts: SearchResultItem[];
  opportunities: SearchResultItem[];
}

const EMPTY_RESULTS: GlobalSearchResults = { companies: [], contacts: [], opportunities: [] };

async function runSearch(query: string): Promise<GlobalSearchResults> {
  if (!supabase) return EMPTY_RESULTS;
  const like = `%${query}%`;

  const [companiesRes, contactsRes, opportunitiesRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name")
      .is("archived_at", null)
      .ilike("name", like)
      .limit(5),
    supabase
      .from("contacts")
      .select("id, name, companies(name)")
      .is("archived_at", null)
      .ilike("name", like)
      .limit(5),
    supabase
      .from("opportunities")
      .select("id, name, stage, companies(name)")
      .or(`name.ilike.${like},job_site_address.ilike.${like}`)
      .limit(5),
  ]);

  const companies: SearchResultItem[] = (companiesRes.data ?? []).map((c) => ({
    id: c.id,
    type: "company",
    title: c.name,
    subtitle: null,
  }));

  const contacts: SearchResultItem[] = (contactsRes.data ?? []).map((c) => ({
    id: c.id,
    type: "contact",
    title: c.name,
    subtitle: (c.companies as { name: string } | null)?.name ?? null,
  }));

  const opportunities: SearchResultItem[] = (opportunitiesRes.data ?? []).map((o) => {
    const companyName = (o.companies as { name: string } | null)?.name ?? null;
    return {
      id: o.id,
      type: "opportunity",
      title: o.name,
      subtitle: companyName ? `${companyName} · ${o.stage}` : o.stage,
    };
  });

  return { companies, contacts, opportunities };
}

export function useGlobalSearch(query: string) {
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;

  useEffect(() => {
    if (!hasQuery) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    setLoading(true);
    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(() => {
      runSearch(trimmed).then((data) => {
        if (requestIdRef.current === requestId) {
          setResults(data);
          setLoading(false);
        }
      });
    }, 250);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, hasQuery]);

  return { results, loading, hasQuery };
}
