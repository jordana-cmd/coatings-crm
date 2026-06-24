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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500 text-sm">{error}</div>
    );
  }

  return (
    <div className="pb-20">
      {opps.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">
            No opportunities yet — add your first.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-gray-900 text-white px-6 py-3 text-base font-medium active:bg-gray-700"
          >
            + New Opportunity
          </button>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {opps.map((opp) => (
              <li key={opp.id}>
                <button
                  onClick={() => navigate(`/opp/${opp.id}`)}
                  className="w-full text-left bg-white rounded-xl p-4 shadow-sm border border-gray-100
                             active:bg-gray-50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {opp.name}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {opp.company_name ?? "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      {STAGE_LABELS[opp.stage] ?? opp.stage}
                    </span>
                    {opp.amount != null && (
                      <p className="text-sm text-gray-600 mt-0.5">
                        ${opp.amount.toLocaleString()}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* FAB */}
          <button
            onClick={() => setShowCreate(true)}
            className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-gray-900 text-white text-2xl
                       shadow-lg flex items-center justify-center active:bg-gray-700 z-40"
          >
            +
          </button>
        </>
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
