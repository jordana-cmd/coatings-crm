import { useState } from "react";
import { LOSS_REASONS, type LossReason } from "../../lib/lossReasons";

/**
 * Reason prompt for closing a deal as a loss. Shared by the Dashboard touch
 * list and the Opportunity detail view — the reason options come from
 * lib/lossReasons.ts so no view carries its own copy of the list.
 */
export default function CloseLossModal({ oppName, saving, error, onSubmit, onClose }: {
  oppName: string;
  saving: boolean;
  error: string | null;
  onSubmit: (reason: LossReason) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<LossReason | null>(null);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-heading">Close as Loss</h2>
          <button onClick={onClose} aria-label="Cancel"
            className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        <p className="text-xs text-label mb-4 truncate">{oppName}</p>

        <div className="space-y-2" role="radiogroup" aria-label="Loss reason">
          {LOSS_REASONS.map((r) => (
            <button key={r} role="radio" aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                reason === r
                  ? "border-brand bg-brand-light text-brand font-medium"
                  : "border-gray-200 text-heading active:bg-gray-50"
              }`}>
              {r}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-xs text-dq bg-dq-bg border border-dq-border rounded-lg px-3 py-2 mt-3">{error}</p>
        )}

        <button onClick={() => { if (reason) onSubmit(reason); }}
          disabled={!reason || saving}
          className="w-full mt-4 rounded-lg bg-brand text-white py-3 text-sm font-medium
                     active:bg-brand-hover disabled:opacity-50">
          {saving ? "Closing..." : "Close as Loss"}
        </button>
        <p className="text-[10px] text-subtle text-center mt-2">
          Moves the deal to Lost and out of the active pipeline.
        </p>
      </div>
    </div>
  );
}
