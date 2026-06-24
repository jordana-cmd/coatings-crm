import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type BidQuoteRow = Database["public"]["Tables"]["bid_quotes"]["Row"];

export interface BidQuoteWithGC extends BidQuoteRow {
  gc_name: string;
}

export function useBidQuotes(oppId: string | undefined) {
  const [quotes, setQuotes] = useState<BidQuoteWithGC[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!supabase || !oppId) return;
    setLoading(true);
    const { data } = await supabase
      .from("bid_quotes")
      .select("*, companies(name)")
      .eq("opportunity_id", oppId)
      .order("created_at", { ascending: true });

    setQuotes(
      (data ?? []).map((q) => ({
        ...q,
        gc_name: (q.companies as { name: string } | null)?.name ?? "—",
      }))
    );
    setLoading(false);
  }, [oppId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addQuote = async (gcCompanyId: string, quotedAmount?: number, notes?: string) => {
    if (!supabase || !oppId) return { error: "Not ready" };
    const { error } = await supabase.from("bid_quotes").insert({
      opportunity_id: oppId,
      gc_company_id: gcCompanyId,
      quoted_amount: quotedAmount ?? null,
      notes: notes ?? null,
    });
    if (error) return { error: error.message };
    await fetch();
    return { error: null };
  };

  const updateQuote = async (id: string, fields: Partial<Pick<BidQuoteRow, "carried_us" | "gc_won_award" | "quoted_amount" | "notes">>) => {
    if (!supabase) return;
    await supabase.from("bid_quotes").update(fields).eq("id", id);
    await fetch();
  };

  const removeQuote = async (id: string) => {
    if (!supabase) return;
    await supabase.from("bid_quotes").delete().eq("id", id);
    await fetch();
  };

  return { quotes, loading, addQuote, updateQuote, removeQuote, refetch: fetch };
}
