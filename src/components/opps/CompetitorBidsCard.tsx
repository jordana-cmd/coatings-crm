import { useState } from "react";
import type { useCompetitorBids, CompetitorBidRow } from "../../hooks/useCompetitorBids";

interface Props {
  competitorBids: ReturnType<typeof useCompetitorBids>;
  /** Our own bid, for the loss-margin hint. */
  ourAmount: number | null;
}

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40";

function money(n: number): string {
  return `$${n.toLocaleString()}`;
}

// ── Add form ──

function AddForm({
  onAdd,
  onCancel,
}: {
  onAdd: (bidderName: string, amount: number, isWinner: boolean, notes: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [bidderName, setBidderName] = useState("");
  const [amount, setAmount] = useState("");
  const [isWinner, setIsWinner] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const parsed = parseFloat(amount);
  const amountValid = Number.isFinite(parsed) && parsed > 0;
  const amountTouched = amount.trim().length > 0;
  const canSubmit = bidderName.trim().length > 0 && amountValid && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setFormError(null);
    const err = await onAdd(bidderName, parsed, isWinner, notes);
    setSaving(false);
    if (err) {
      setFormError(err);
      return;
    }
    onCancel();
  };

  return (
    <div className="mt-3 rounded-lg border border-card-border p-3 space-y-2">
      <input
        className={inputCls}
        placeholder="Bidder name"
        value={bidderName}
        onChange={(e) => setBidderName(e.target.value)}
        autoFocus
      />
      <input
        className={inputCls}
        placeholder="Bid amount"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {amountTouched && !amountValid && (
        <p className="text-xs text-dq">Amount must be a number greater than 0.</p>
      )}
      <input
        className={inputCls}
        placeholder="Notes (e.g. source of the number)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <label className="flex items-center gap-2 cursor-pointer py-1">
        <input
          type="checkbox"
          checked={isWinner}
          onChange={(e) => setIsWinner(e.target.checked)}
          className="rounded border-gray-300 text-brand focus:ring-brand h-4 w-4"
        />
        <span className="text-sm text-label">This bid won the project</span>
      </label>

      {formError && <p className="text-xs text-dq">{formError}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="flex-1 rounded-lg bg-brand text-white py-2 text-sm font-medium active:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Add bid"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-label disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Row ──

function BidRow({
  bid,
  ourAmount,
  onSave,
  onMarkWinner,
  onClearWinner,
  onRemove,
}: {
  bid: CompetitorBidRow;
  ourAmount: number | null;
  onSave: (bidderName: string, amount: number, notes: string) => Promise<string | null>;
  onMarkWinner: () => Promise<string | null>;
  onClearWinner: () => Promise<string | null>;
  onRemove: () => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [bidderName, setBidderName] = useState(bid.bidder_name);
  const [amount, setAmount] = useState(String(bid.amount));
  const [notes, setNotes] = useState(bid.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const parsed = parseFloat(amount);
  const amountValid = Number.isFinite(parsed) && parsed > 0;
  const canSave = bidderName.trim().length > 0 && amountValid && !busy;

  const run = async (fn: () => Promise<string | null>, thenClose?: () => void) => {
    setBusy(true);
    setRowError(null);
    const err = await fn();
    setBusy(false);
    if (err) {
      setRowError(err);
      return;
    }
    thenClose?.();
  };

  // Positive = we were above this bid (lost by that much).
  const delta = ourAmount != null ? ourAmount - bid.amount : null;

  if (editing) {
    return (
      <div className="rounded-lg border border-brand/30 p-3 space-y-2">
        <input className={inputCls} value={bidderName} onChange={(e) => setBidderName(e.target.value)} />
        <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        {!amountValid && <p className="text-xs text-dq">Amount must be greater than 0.</p>}
        <input className={inputCls} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {rowError && <p className="text-xs text-dq">{rowError}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => run(() => onSave(bidderName, parsed, notes), () => setEditing(false))}
            disabled={!canSave}
            className="flex-1 rounded-lg bg-brand text-white py-2 text-sm font-medium active:bg-brand-hover disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => {
              setBidderName(bid.bidder_name);
              setAmount(String(bid.amount));
              setNotes(bid.notes ?? "");
              setRowError(null);
              setEditing(false);
            }}
            disabled={busy}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-label disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-3 ${
        bid.is_winner ? "border-gate-met/30 bg-gate-met-light/30" : "border-card-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-heading truncate">{bid.bidder_name}</span>
          {bid.is_winner && (
            <span className="shrink-0 text-[10px] font-bold text-gate-met bg-white rounded px-1.5 py-0.5">
              WINNER
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-heading shrink-0">{money(bid.amount)}</span>
      </div>

      {delta != null && (
        <p className="text-[11px] text-subtle">
          {delta > 0
            ? `We were ${money(delta)} higher`
            : delta < 0
              ? `We were ${money(Math.abs(delta))} lower`
              : "Same as our bid"}
        </p>
      )}

      {bid.notes && <p className="text-xs text-subtle mt-1">{bid.notes}</p>}

      {rowError && <p className="text-xs text-dq mt-1">{rowError}</p>}

      <div className="flex items-center gap-3 mt-2 text-[11px]">
        {bid.is_winner ? (
          <button onClick={() => run(onClearWinner)} disabled={busy} className="text-label hover:text-heading disabled:opacity-50">
            Unmark winner
          </button>
        ) : (
          <button onClick={() => run(onMarkWinner)} disabled={busy} className="text-brand font-medium disabled:opacity-50">
            Mark winner
          </button>
        )}
        <button onClick={() => setEditing(true)} disabled={busy} className="text-label hover:text-heading disabled:opacity-50">
          Edit
        </button>
        <button onClick={() => run(onRemove)} disabled={busy} className="text-subtle hover:text-dq disabled:opacity-50">
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Card ──

export default function CompetitorBidsCard({ competitorBids, ourAmount }: Props) {
  const { bids, loading, error, addBid, updateBid, markWinner, clearWinner, removeBid } = competitorBids;
  const [showAdd, setShowAdd] = useState(false);

  const winner = bids.find((b) => b.is_winner);
  const spread =
    bids.length > 1 ? Math.max(...bids.map((b) => b.amount)) - Math.min(...bids.map((b) => b.amount)) : null;

  return (
    <div
      className="bg-card rounded-2xl p-5"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-semibold text-label uppercase tracking-wider">Competitor Bids</h3>
          {bids.length > 0 && (
            <p className="text-[10px] text-subtle mt-0.5">
              {bids.length} bid{bids.length !== 1 ? "s" : ""} recorded
              {spread != null ? ` · ${money(spread)} spread` : ""}
            </p>
          )}
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="text-xs text-brand font-medium">
            + Add bid
          </button>
        )}
      </div>

      {winner && (
        <div className="rounded-lg bg-gate-met-light border border-gate-met/20 px-3 py-2 mb-3 flex items-center gap-2">
          <span className="text-[10px] font-bold text-gate-met bg-white rounded px-1.5 py-0.5">WON</span>
          <span className="text-sm font-medium text-gate-met truncate">
            {winner.bidder_name} — {money(winner.amount)}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-shell-border border-t-brand" />
        </div>
      ) : error ? (
        <p className="text-sm text-dq bg-dq-bg border border-dq-border rounded-lg px-3 py-2">{error}</p>
      ) : bids.length === 0 ? (
        <p className="text-sm text-subtle text-center py-6">No competitor bids recorded yet</p>
      ) : (
        <div className="space-y-2">
          {bids.map((b) => (
            <BidRow
              key={b.id}
              bid={b}
              ourAmount={ourAmount}
              onSave={async (bidderName, amount, notes) =>
                (await updateBid(b.id, { bidderName, amount, notes })).error
              }
              onMarkWinner={async () => (await markWinner(b.id)).error}
              onClearWinner={async () => (await clearWinner(b.id)).error}
              onRemove={async () => (await removeBid(b.id)).error}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddForm
          onAdd={async (bidderName, amount, isWinner, notes) =>
            (await addBid({ bidderName, amount, isWinner, notes })).error
          }
          onCancel={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
