import { useState } from "react";
import QuickLogSheet from "./QuickLogSheet";
import { useQuickLog } from "../../hooks/useQuickLog";
import type { Database } from "../../lib/database.types";

type ActivityType = Database["public"]["Enums"]["activity_type"];

interface Props { opportunityId: string; onLogged: () => void; }

export default function QuickLogFAB({ opportunityId, onLogged }: Props) {
  const [open, setOpen] = useState(false);
  const { log, pending, failed, syncing } = useQuickLog();

  const handleLog = async (input: {
    type: ActivityType; note?: string; nextAction?: string; nextActionAt?: string;
  }) => {
    await log({ opportunityId, type: input.type, note: input.note, nextAction: input.nextAction, nextActionAt: input.nextActionAt });
    onLogged();
  };

  return (
    <>
      {(pending > 0 || failed > 0) && (
        <div className="fixed bottom-36 md:bottom-24 right-4 z-40 space-y-1">
          {pending > 0 && (
            <div className={`rounded-full px-3 py-1 text-xs font-medium shadow
              ${syncing ? "bg-blue-100 text-blue-700" : "bg-pending-light text-pending"}`}>
              {syncing ? "Syncing..." : `${pending} pending`}
            </div>
          )}
          {failed > 0 && (
            <div className="rounded-full bg-dq-bg text-dq border border-dq-border px-3 py-1 text-xs font-medium shadow">
              {failed} failed
            </div>
          )}
        </div>
      )}
      <button onClick={() => setOpen(true)}
        className="fixed bottom-20 md:bottom-8 right-4 h-14 w-14 rounded-full bg-brand text-white text-2xl
                   shadow-lg flex items-center justify-center active:bg-brand-hover z-40"
        aria-label="Log activity">
        +
      </button>
      {open && <QuickLogSheet onLog={handleLog} onClose={() => setOpen(false)} />}
    </>
  );
}
