import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type FederalUpdate = Database["public"]["Tables"]["federal_details"]["Update"];

async function invokeError(err: unknown): Promise<string> {
  // FunctionsHttpError carries the JSON error body on err.context
  const e = err as { message?: string; context?: Response };
  try {
    if (e?.context) {
      const body = await e.context.json();
      if (body?.error) return String(body.error);
    }
  } catch {
    // fall through to message
  }
  return e?.message ?? "Request failed";
}

/**
 * Field updates + AI actions (claude-extract / claude-score Edge Functions)
 * for a FEDERAL opportunity's federal_details row.
 */
export function useFederalDetails(oppId: string, refetch: () => Promise<void>) {
  const [saving, setSaving] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateFederalField = async <K extends keyof FederalUpdate>(
    field: K,
    value: FederalUpdate[K]
  ) => {
    if (!supabase) return;
    setSaving(field as string);
    setError(null);

    const { error: err } = await supabase
      .from("federal_details")
      .update({ [field]: value } as FederalUpdate)
      .eq("opportunity_id", oppId);

    if (err) setError(err.message);
    else await refetch();
    setSaving(null);
  };

  const runExtraction = async () => {
    if (!supabase) return;
    setExtracting(true);
    setError(null);
    const { error: err } = await supabase.functions.invoke("claude-extract", {
      body: { opportunity_id: oppId },
    });
    if (err) setError(await invokeError(err));
    await refetch(); // refetch either way — status may be FAILED with details
    setExtracting(false);
  };

  const runScoring = async () => {
    if (!supabase) return;
    setScoring(true);
    setError(null);
    const { error: err } = await supabase.functions.invoke("claude-score", {
      body: { opportunity_id: oppId },
    });
    if (err) setError(await invokeError(err));
    await refetch();
    setScoring(false);
  };

  return { updateFederalField, runExtraction, runScoring, saving, extracting, scoring, error };
}
