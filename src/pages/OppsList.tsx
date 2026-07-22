import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { supabase } from "../lib/supabase";
import { parseRpcBlockReason } from "../lib/gates/labels";
import { useOpportunities } from "../hooks/useOpportunities";
import {
  stagesFor,
  STAGE_LABELS,
  PIPELINE_LABELS,
  PUBLIC_BID_ACTIVE,
  GC_CHASE_ACTIVE,
  FACILITY_ACTIVE,
  FEDERAL_ACTIVE,
  type Pipeline,
} from "../lib/pipelines";
import type { Database } from "../lib/database.types";
import CreateOppForm from "../components/opps/CreateOppForm";

type Opp = Database["public"]["Tables"]["opportunities"]["Row"] & {
  company_name: string | null;
};

const PIPELINES: Pipeline[] = ["PUBLIC_BID", "GC_CHASE", "FACILITY", "FEDERAL"];

function getActiveStages(pipeline: Pipeline): readonly string[] {
  switch (pipeline) {
    case "PUBLIC_BID": return PUBLIC_BID_ACTIVE;
    case "GC_CHASE": return GC_CHASE_ACTIVE;
    case "FACILITY": return FACILITY_ACTIVE;
    case "FEDERAL": return FEDERAL_ACTIVE;
  }
}

function getTerminalStages(pipeline: Pipeline): string[] {
  const all = stagesFor(pipeline);
  const active = getActiveStages(pipeline);
  return (all as string[]).filter((s) => !(active as readonly string[]).includes(s));
}

function isValidDrop(pipeline: Pipeline, fromStage: string, toStage: string): boolean {
  if (fromStage === toStage) return false;
  const active = getActiveStages(pipeline);
  const fromIdx = active.indexOf(fromStage);
  if (fromIdx === -1) return false;
  // Next active stage
  if (fromIdx + 1 < active.length && active[fromIdx + 1] === toStage) return true;
  // Terminal from last active or SUBMITTED for PUBLIC_BID
  const terminals = getTerminalStages(pipeline);
  if (terminals.includes(toStage)) {
    // Only allow terminal from the last active stage
    if (pipeline === "PUBLIC_BID" && fromStage === "SUBMITTED" && (toStage === "AWARDED" || toStage === "LOST")) return true;
    if (pipeline === "GC_CHASE" && fromStage === "GC_AWARDED" && (toStage === "WON" || toStage === "LOST")) return true;
    if (pipeline === "FACILITY" && fromStage === "APPROVAL" && (toStage === "WON" || toStage === "LOST")) return true;
    if (pipeline === "FEDERAL" && fromStage === "SUBMITTED" && (toStage === "AWARDED" || toStage === "LOST")) return true;
  }
  return false;
}

// ── Opp Card ──

const PRIORITY_COLORS: Record<string, string> = {
  A: "bg-brand-light text-brand", B: "bg-pending-light text-pending", C: "bg-gray-100 text-label",
};

function OppCard({ opp, isDragOverlay }: { opp: Opp; isDragOverlay?: boolean }) {
  const navigate = useNavigate();
  const isWon = opp.status === "WON";
  const isDq = opp.status === "DISQUALIFIED";
  const isLost = opp.status === "LOST";

  const ageDays = opp.stage_entered_at
    ? Math.floor((Date.now() - new Date(opp.stage_entered_at).getTime()) / 86400000)
    : null;
  const stale = ageDays != null && ageDays > 14;
  const noNextStep = !opp.next_step_date && opp.status === "OPEN";

  return (
    <div
      onClick={isDragOverlay ? undefined : () => navigate(`/opp/${opp.id}`)}
      className={`bg-card rounded-lg p-3 shadow-sm border cursor-pointer active:shadow-md transition-shadow
        ${isDq ? "border-dq-border bg-dq-bg" : isWon ? "border-gate-met/30" : isLost ? "border-subtle/30" : stale ? "border-pending/40" : "border-card-border"}
        ${isDragOverlay ? "shadow-lg ring-2 ring-brand/30 rotate-2" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <p className={`text-sm font-medium truncate flex-1 ${isDq ? "text-dq line-through" : "text-heading"}`}>
          {opp.name}
        </p>
        {opp.priority && (
          <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${PRIORITY_COLORS[opp.priority] ?? "bg-gray-100 text-label"}`}>
            {opp.priority}
          </span>
        )}
      </div>
      <p className="text-xs text-label truncate mt-0.5">{opp.company_name ?? "—"}</p>
      <div className="flex items-center justify-between mt-2">
        {opp.amount != null ? (
          <span className="text-sm font-semibold text-heading">${opp.amount.toLocaleString()}</span>
        ) : (
          <span className="text-xs text-subtle">No amount</span>
        )}
        <div className="flex items-center gap-1">
          {ageDays != null && (
            <span className={`text-[9px] font-medium ${stale ? "text-pending" : "text-subtle"}`}>
              {ageDays}d
            </span>
          )}
          {noNextStep && <span className="w-1.5 h-1.5 rounded-full bg-pending/60 shrink-0" title="No next step" />}
          {isWon && <span className="text-[10px] font-bold text-gate-met bg-gate-met-light px-1.5 py-0.5 rounded">WON</span>}
          {isDq && <span className="text-[10px] font-bold text-dq bg-dq-bg border border-dq-border px-1.5 py-0.5 rounded">DQ</span>}
          {isLost && <span className="text-[10px] font-bold text-dq bg-dq-bg px-1.5 py-0.5 rounded">LOST</span>}
        </div>
      </div>
    </div>
  );
}

function DraggableCard({ opp }: { opp: Opp }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: opp.id,
    data: { opp },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <OppCard opp={opp} />
    </div>
  );
}

// ── Column ──

function StageColumn({
  stage,
  opps,
  pipeline,
}: {
  stage: string;
  opps: Opp[];
  pipeline: Pipeline;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, data: { stage, pipeline } });
  const total = opps.reduce((s, o) => s + (o.amount ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-56 shrink-0 md:shrink md:w-0 md:flex-1 md:min-w-0 rounded-xl border transition-colors
        ${isOver
          ? "bg-brand/5 border-brand/30 ring-2 ring-brand/20"
          : "bg-gray-100 border-gray-200"}`}
    >
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-heading truncate">{STAGE_LABELS[stage] ?? stage}</h3>
        <p className="text-[10px] text-label mt-0.5">
          {opps.length} deal{opps.length !== 1 ? "s" : ""}
          {total > 0 ? ` · $${total.toLocaleString()}` : ""}
        </p>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100svh-220px)]">
        {opps.map((opp) => (
          <DraggableCard key={opp.id} opp={opp} />
        ))}
        {opps.length === 0 && (
          <p className="text-xs text-label text-center py-6">No deals</p>
        )}
      </div>
    </div>
  );
}

// ── Toast ──

function Toast({ title, reasons, onClose }: { title: string; reasons: string[]; onClose: () => void }) {
  // Auto-dismiss after 6s
  useState(() => { const t = setTimeout(onClose, 6000); return () => clearTimeout(t); });

  return (
    <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50
                    bg-card border border-pending/40 rounded-xl shadow-lg p-4 max-w-md w-[92vw]"
         style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-pending">{title}</p>
        <button onClick={onClose} className="text-subtle text-lg leading-none shrink-0">&times;</button>
      </div>
      {reasons.length > 0 && (
        <ul className="space-y-0.5">
          {reasons.map((r, i) => (
            <li key={i} className="text-xs text-label flex items-start gap-1.5">
              <span className="text-pending mt-0.5 shrink-0">&#x25CB;</span>
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main Board ──

export default function OppsList() {
  const { opps, loading, error, create, refetch } = useOpportunities();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPipeline = searchParams.get("pipeline");
  const [pipeline, setPipeline] = useState<Pipeline>(
    PIPELINES.includes(initialPipeline as Pipeline) ? (initialPipeline as Pipeline) : "PUBLIC_BID"
  );
  const [showCreate, setShowCreate] = useState(false);
  const [activeOpp, setActiveOpp] = useState<Opp | null>(null);
  const [toast, setToast] = useState<{ title: string; reasons: string[] } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const pipelineOpps = opps.filter((o) => o.pipeline === pipeline);
  const stages = stagesFor(pipeline);

  const oppsByStage: Record<string, Opp[]> = {};
  for (const s of stages) oppsByStage[s] = [];
  for (const o of pipelineOpps) {
    if (oppsByStage[o.stage]) oppsByStage[o.stage].push(o);
  }

  const handleDragStart = (event: DragStartEvent) => {
    const opp = event.active.data.current?.opp as Opp | undefined;
    setActiveOpp(opp ?? null);
  };

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveOpp(null);
      const { active, over } = event;
      if (!over) return;

      const opp = active.data.current?.opp as Opp | undefined;
      const targetStage = over.id as string;
      if (!opp || opp.stage === targetStage) return;

      if (!isValidDrop(pipeline, opp.stage, targetStage)) {
        setToast({
          title: `Can't move to ${STAGE_LABELS[targetStage] ?? targetStage}`,
          reasons: ["Must advance one stage at a time — no skipping"],
        });
        return;
      }

      // Call advance_stage RPC
      if (!supabase) return;
      const { error: err } = await supabase.rpc("advance_stage", {
        p_opp_id: opp.id,
        p_target_stage: targetStage,
      });

      if (err) {
        const reasons = parseRpcBlockReason(err.message);
        setToast({
          title: `Can't advance to ${STAGE_LABELS[targetStage] ?? targetStage}`,
          reasons,
        });
      } else {
        await refetch();
      }
    },
    [pipeline, refetch]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-shell-border border-t-brand" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-card rounded-xl shadow-sm p-8">
          <p className="text-brand text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-heading">Pipeline</h1>

        <div className="flex items-center gap-2">
          {/* Pipeline switcher */}
          <div className="flex bg-gray-200 rounded-lg p-0.5">
            {PIPELINES.map((p) => (
              <button
                key={p}
                onClick={() => setPipeline(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                  ${pipeline === p ? "bg-brand text-white" : "text-label hover:text-heading"}`}
              >
                {PIPELINE_LABELS[p]}
              </button>
            ))}
          </div>

          {pipeline === "FEDERAL" && (
            <button
              onClick={() => navigate("/opportunities/sam-import")}
              className="rounded-lg border border-card-border bg-card text-heading px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Pull SAM.gov
            </button>
          )}

          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium active:bg-brand-hover"
          >
            + New
          </button>
        </div>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-x-hidden">
          {(stages as readonly string[]).map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              opps={oppsByStage[stage] ?? []}
              pipeline={pipeline}
            />
          ))}
        </div>

        <DragOverlay>
          {activeOpp ? <OppCard opp={activeOpp} isDragOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Toast for gate failures */}
      {toast && <Toast title={toast.title} reasons={toast.reasons} onClose={() => setToast(null)} />}

      {/* Create form */}
      {showCreate && (
        <CreateOppForm
          pipeline={pipeline}
          onSubmit={async (input) => {
            const result = await create(input);
            if (!result.error) setShowCreate(false);
            return result;
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
