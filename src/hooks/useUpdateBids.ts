import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type BidsUpdate = Database["public"]["Tables"]["bids"]["Update"];
type OppUpdate = Database["public"]["Tables"]["opportunities"]["Update"];

export function useUpdateBids(oppId: string, refetch: () => Promise<void>) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateBidsField = async <K extends keyof BidsUpdate>(
    field: K,
    value: BidsUpdate[K]
  ) => {
    if (!supabase) return;
    setSaving(field as string);
    setError(null);

    const { error: err } = await supabase
      .from("bids")
      .update({ [field]: value } as BidsUpdate)
      .eq("opportunity_id", oppId);

    if (err) {
      setError(err.message);
    } else {
      await refetch();
    }
    setSaving(null);
  };

  const updateOppField = async <K extends keyof OppUpdate>(
    field: K,
    value: OppUpdate[K]
  ) => {
    if (!supabase) return;
    setSaving(field as string);
    setError(null);

    const { error: err } = await supabase
      .from("opportunities")
      .update({ [field]: value } as OppUpdate)
      .eq("id", oppId);

    if (err) {
      setError(err.message);
    } else {
      await refetch();
    }
    setSaving(null);
  };

  return { updateBidsField, updateOppField, saving, error };
}
