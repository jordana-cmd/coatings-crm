import { useCallback, useEffect, useState } from "react";
import { enqueue, drain, getQueueCounts } from "../lib/offline-queue";
import { useAuth } from "./useAuth";
import type { Database } from "../lib/database.types";

type ActivityType = Database["public"]["Enums"]["activity_type"];

export function useQuickLog() {
  const { user } = useAuth();
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCounts = useCallback(async () => {
    const counts = await getQueueCounts();
    setPending(counts.pending);
    setFailed(counts.failed);
  }, []);

  const doDrain = useCallback(async () => {
    setSyncing(true);
    await drain();
    await refreshCounts();
    setSyncing(false);
  }, [refreshCounts]);

  // Drain on mount and on online event
  useEffect(() => {
    refreshCounts();
    doDrain();

    const onOnline = () => doDrain();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [doDrain, refreshCounts]);

  const log = useCallback(
    async (input: {
      opportunityId: string;
      type: ActivityType;
      note?: string;
      nextAction?: string;
      nextActionAt?: string;
    }) => {
      if (!user) return;

      await enqueue({
        id: crypto.randomUUID(),
        opportunity_id: input.opportunityId,
        user_id: user.id,
        type: input.type,
        note: input.note ?? null,
        next_action: input.nextAction ?? null,
        next_action_at: input.nextActionAt ?? null,
        logged_at: new Date().toISOString(),
      });

      await refreshCounts();
      // Trigger drain (fires and forgets — if offline it'll just stop)
      doDrain();
    },
    [user, refreshCounts, doDrain]
  );

  return { log, pending, failed, syncing };
}
