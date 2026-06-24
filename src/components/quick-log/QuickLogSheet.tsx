import { useState } from "react";
import type { Database } from "../../lib/database.types";

type ActivityType = Database["public"]["Enums"]["activity_type"];

interface ContactOption {
  id: string;
  name: string;
}

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: string }[] = [
  { value: "CALL", label: "Call", icon: "\u{1F4DE}" },
  { value: "VISIT", label: "Visit", icon: "\u{1F3D7}\uFE0F" },
  { value: "PREBID_WALK", label: "Pre-Bid Walk", icon: "\u{1F6B6}" },
  { value: "EMAIL", label: "Email", icon: "\u2709\uFE0F" },
  { value: "NOTE", label: "Note", icon: "\u{1F4DD}" },
];

interface Props {
  contacts?: ContactOption[];
  onLog: (input: { type: ActivityType; note?: string; contactId?: string; nextAction?: string; nextActionAt?: string }) => void;
  onClose: () => void;
}

export default function QuickLogSheet({ contacts, onLog, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [note, setNote] = useState("");
  const [contactId, setContactId] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");

  const handleConfirm = () => {
    if (!selectedType) return;
    onLog({
      type: selectedType,
      note: note.trim() || undefined,
      contactId: contactId || undefined,
      nextAction: nextAction.trim() || undefined,
      nextActionAt: nextActionAt || undefined,
    });
    onClose();
  };

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="w-full max-w-lg bg-card rounded-t-2xl p-5 max-h-[80svh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-heading">{step === 1 ? "Log Activity" : "Confirm"}</h2>
          <button type="button" onClick={onClose} className="text-subtle text-2xl leading-none">&times;</button>
        </div>
        {step === 1 ? (
          <div className="grid grid-cols-2 gap-3">
            {ACTIVITY_TYPES.map((t) => (
              <button key={t.value} onClick={() => { setSelectedType(t.value); setStep(2); }}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-gray-200
                           bg-white p-5 text-center active:border-brand active:bg-brand-light">
                <span className="text-2xl">{t.icon}</span>
                <span className="text-sm font-medium text-heading">{t.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep(1)} className="text-sm text-brand">&larr; Change</button>
              <span className="text-sm font-medium text-heading">
                {ACTIVITY_TYPES.find((t) => t.value === selectedType)?.icon}{" "}
                {ACTIVITY_TYPES.find((t) => t.value === selectedType)?.label}
              </span>
            </div>

            {/* Contact picker — optional, only shown if contacts available */}
            {contacts && contacts.length > 0 && (
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputCls}>
                <option value="">Contact (optional)</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}

            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" rows={2} className={inputCls} />
            <input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Next action (optional)" className={inputCls} />
            {nextAction && <input type="date" value={nextActionAt} onChange={(e) => setNextActionAt(e.target.value)} className={inputCls} />}
            <button onClick={handleConfirm}
              className="w-full rounded-lg bg-brand text-white py-3 text-sm font-medium active:bg-brand-hover">
              Log it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
