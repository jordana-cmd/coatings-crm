import { useState } from "react";
import { supabase } from "../lib/supabase";

export function useAdvanceStage(oppId: string, refetch: () => Promise<void>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const advance = async (targetStage: string) => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.rpc("advance_stage", {
      p_opp_id: oppId,
      p_target_stage: targetStage,
    });

    if (err) {
      setError(err.message);
    } else {
      await refetch();
    }
    setLoading(false);
  };

  return { advance, loading, error, clearError: () => setError(null) };
}
