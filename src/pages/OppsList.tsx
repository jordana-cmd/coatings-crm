import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOpportunities } from "../hooks/useOpportunities";
import { STAGE_LABELS } from "../lib/pipelines";
import CreateOppForm from "../components/opps/CreateOppForm";

export default function OppsList() {
  const { opps, loading, error, create } = useOpportunities();
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

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
    <div className="pb-20 md:pb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Opportunities</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium active:bg-brand-hover"
        >
          + New
        </button>
      </div>

      {opps.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm p-12 text-center">
          <p className="text-label mb-4">No opportunities yet — add your first.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-brand text-white px-6 py-3 text-base font-medium active:bg-brand-hover"
          >
            + New Opportunity
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-card-border">
            {opps.map((opp) => (
              <button
                key={opp.id}
                onClick={() => navigate(`/opp/${opp.id}`)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-3
                           hover:bg-gray-50 active:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm text-heading truncate">{opp.name}</p>
                  <p className="text-xs text-label truncate">{opp.company_name ?? "—"}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-heading">
                    {STAGE_LABELS[opp.stage] ?? opp.stage}
                  </span>
                  {opp.amount != null && (
                    <p className="text-xs text-label mt-0.5">${opp.amount.toLocaleString()}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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
