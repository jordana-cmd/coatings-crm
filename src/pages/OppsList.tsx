import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import { useOpportunities } from "../hooks/useOpportunities";
import {
  stagesFor,
  STAGE_LABELS,
  PIPELINE_LABELS,
  PUBLIC_BID_ACTIVE,
  GC_CHASE_ACTIVE,
  FACILITY_ACTIVE,
  type Pipeline,
} from "../lib/pipelines";
import type { Database } from "../lib/database.types";
import CreateOppForm from "../components/opps/CreateOppForm";

type Opp = Database["public"]["Tables"]["opportunities"]["Row"] & {
  company_name: string | null;
};

const PIPELINES: Pipeline[] = ["PUBLIC_BID", "GC_CHASE", "FACILITY"];

function getActiveStages(pipeline: Pipeline): readonly string[] {
  return pipeline === "PUBLIC_BID"
    ? PUBLIC_BID_ACTIVE
    : pipeline === "GC_CHASE"
      ? GC_CHASE_ACTIVE
      : FACILITY_ACTIVE;
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
    if (pipeline === "FACILITY" && fromStage === "APPROVAL" && (toStage === "WON" || toStage === "LOST" || toStage === "NURTURE")) return true;
  }
  return false;
}

// ── Opp Card ──

function OppCard({ opp, isDragOverlay }: { opp: Opp; isDragOverlay?: boolean }) {
  const navigate = useNavigate();
  const isWon = opp.status === "WON";
  const isDq = opp.status === "DISQUALIFIED";
  const isLost = opp.status === "LOST";

  return (
    <div
      onClick={isDragOverlay ? undefined : () => navigate(`/opp/${opp.id}`)}
      className={`bg-card rounded-lg p-3 shadow-sm border cursor-pointer active:shadow-md transition-shadow
        ${isDq ? "border-dq-border bg-dq-bg" : isWon ? "border-gate-met/30" : isLost ? "border-subtle/30" : "border-card-border"}
        ${isDragOverlay ? "shadow-lg ring-2 ring-brand/30 rotate-2" : ""}`}
    >
      <p className={`text-sm font-medium truncate ${isDq ? "text-dq line-through" : "text-heading"}`}>
        {opp.name}
      </p>
      <p className="text-xs text-label truncate mt-0.5">{opp.company_name ?? "—"}</p>
      <div className="flex items-center justify-between mt-2">
        {opp.amount != null ? (
          <span className="text-sm font-semibold text-heading">${opp.amount.toLocaleString()}</span>
        ) : (
          <span className="text-xs text-subtle">No amount</span>
        )}
        {isWon && <span className="text-[10px] font-bold text-gate-met bg-gate-met-light px-1.5 py-0.5 rounded">WON</span>}
        {isDq && <span className="text-[10px] font-bold text-dq bg-dq-bg border border-dq-border px-1.5 py-0.5 rounded">DQ</span>}
        {isLost && <span className="text-[10px] font-bold text-dq bg-dq-bg px-1.5 py-0.5 rounded">LOST</span>}
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
      className={`flex flex-col w-64 md:w-72 shrink-0 rounded-xl transition-colors
        ${isOver ? "bg-brand/10 ring-2 ring-brand/30" : "bg-shell-light/30"}`}
    >
      {/* Header */}
      <div className="px-3 py-3 border-b border-shell-border/30">
        <h3 className="text-sm font-semibold text-white">{STAGE_LABELS[stage] ?? stage}</h3>
        <p className="text-[10px] text-subtle mt-0.5">
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
          <p className="text-xs text-subtle text-center py-6">No deals</p>
        )}
      </div>
    </div>
  );
}

// ── Toast ──

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50
                    bg-card border border-dq-border rounded-xl shadow-lg p-4 max-w-sm w-[90vw]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-dq">{message}</p>
        <button onClick={onClose} className="text-subtle text-lg leading-none shrink-0">&times;</button>
      </div>
    </div>
  );
}

// ── Main Board ──

export default function OppsList() {
  const { opps, loading, error, create, refetch } = useOpportunities();
  const [pipeline, setPipeline] = useState<Pipeline>("PUBLIC_BID");
  const [showCreate, setShowCreate] = useState(false);
  const [activeOpp, setActiveOpp] = useState<Opp | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
        setToast(`Cannot move from ${STAGE_LABELS[opp.stage]} to ${STAGE_LABELS[targetStage]} — must advance one stage at a time`);
        return;
      }

      // Call advance_stage RPC
      if (!supabase) return;
      const { error: err } = await supabase.rpc("advance_stage", {
        p_opp_id: opp.id,
        p_target_stage: targetStage,
      });

      if (err) {
        setToast(err.message);
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
        <h1 className="text-xl font-bold text-white">Pipeline</h1>

        <div className="flex items-center gap-2">
          {/* Pipeline switcher */}
          <div className="flex bg-shell-light rounded-lg p-0.5">
            {PIPELINES.map((p) => (
              <button
                key={p}
                onClick={() => setPipeline(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                  ${pipeline === p ? "bg-brand text-white" : "text-subtle hover:text-white"}`}
              >
                {PIPELINE_LABELS[p]}
              </button>
            ))}
          </div>

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
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
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
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Create form */}
      {showCreate && (
        <CreateOppForm
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
