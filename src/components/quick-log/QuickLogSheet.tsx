import { useState } from "react";
import type { Database } from "../../lib/database.types";

type ActivityType = Database["public"]["Enums"]["activity_type"];

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: string }[] = [
  { value: "CALL", label: "Call", icon: "📞" },
  { value: "VISIT", label: "Visit", icon: "🏗️" },
  { value: "PREBID_WALK", label: "Pre-Bid Walk", icon: "🚶" },
  { value: "EMAIL", label: "Email", icon: "✉️" },
  { value: "NOTE", label: "Note", icon: "📝" },
];

interface Props {
  onLog: (input: {
    type: ActivityType;
    note?: string;
    nextAction?: string;
    nextActionAt?: string;
  }) => void;
  onClose: () => void;
}

export default function QuickLogSheet({ onLog, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [note, setNote] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");

  const handleTypeSelect = (type: ActivityType) => {
    setSelectedType(type);
    setStep(2);
  };

  const handleConfirm = () => {
    if (!selectedType) return;
    onLog({
      type: selectedType,
      note: note.trim() || undefined,
      nextAction: nextAction.trim() || undefined,
      nextActionAt: nextActionAt || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
      <div className="w-full max-w-lg bg-white rounded-t-2xl p-5 max-h-[80svh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-primary">
            {step === 1 ? "Log Activity" : "Confirm"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {step === 1 ? (
          <div className="grid grid-cols-2 gap-3">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => handleTypeSelect(t.value)}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-gray-200
                           bg-surface p-5 text-center active:border-brand active:bg-brand/5"
              >
                <span className="text-2xl">{t.icon}</span>
                <span className="text-sm font-medium text-text-primary">{t.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-brand"
              >
                &larr; Change
              </button>
              <span className="text-sm font-medium text-gray-700">
                {ACTIVITY_TYPES.find((t) => t.value === selectedType)?.icon}{" "}
                {ACTIVITY_TYPES.find((t) => t.value === selectedType)?.label}
              </span>
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand"
            />

            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="Next action (optional)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand"
            />

            {nextAction && (
              <input
                type="date"
                value={nextActionAt}
                onChange={(e) => setNextActionAt(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand"
              />
            )}

            <button
              onClick={handleConfirm}
              className="w-full rounded-lg bg-brand text-white py-3 text-base font-medium
                         active:bg-brand-hover"
            >
              Log it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
