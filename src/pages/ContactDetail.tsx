import { useParams, useNavigate } from "react-router-dom";
import { useContact, useContactActivities } from "../hooks/useContacts";
import { Phone, Mail, UserCheck } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  PM: "PM", ESTIMATOR: "Estimator", SUPER: "Super", FM: "FM",
  PURCHASING: "Purchasing", SPEC_WRITER: "Spec Writer",
};

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error } = useContact(id);
  const { activities, loading: actsLoading } = useContactActivities(
    id, data?.company_id
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-shell-border border-t-brand" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <div className="bg-card rounded-xl shadow-sm p-8">
          <p className="text-brand text-sm mb-4">{error ?? "Not found"}</p>
          <button onClick={() => navigate("/contacts")} className="text-sm text-brand font-medium">&larr; Back</button>
        </div>
      </div>
    );
  }

  const { contact: c, company_name } = data;

  return (
    <div className="space-y-4 pb-16 md:pb-6">
      <button onClick={() => navigate("/contacts")} className="text-sm text-brand font-medium">&larr; Contacts</button>

      {/* Header */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-lg font-bold text-heading">{c.name}</h1>
          {c.is_decision_maker && (
            <span className="flex items-center gap-0.5 text-xs text-gate-met font-medium">
              <UserCheck size={14} /> Decision Maker
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-heading">
            {ROLE_LABELS[c.role] ?? c.role}
          </span>
          <button onClick={() => navigate(`/companies/${c.company_id}`)}
            className="text-xs text-brand font-medium">
            {company_name ?? "Company"}
          </button>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-sm text-brand font-medium">
            <Phone size={16} /> {c.phone}
          </a>
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-sm text-brand font-medium">
              <Mail size={16} /> {c.email}
            </a>
          )}
        </div>
      </div>

      {/* Activity history */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <h3 className="text-xs font-semibold text-label uppercase tracking-wide mb-3">
          Activity History ({activities.length})
        </h3>
        {actsLoading ? (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-subtle text-center py-4">No activity history yet.</p>
        ) : (
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <div className="shrink-0 mt-0.5">
                  <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-label">
                    {a.type}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  {a.note && <p className="text-heading text-sm">{a.note}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <button onClick={() => navigate(`/opp/${a.opp_id}`)}
                      className="text-xs text-brand truncate">
                      {a.opp_name}
                    </button>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      a.direct ? "bg-gate-met-light text-gate-met" : "bg-gray-100 text-subtle"
                    }`}>
                      {a.direct ? "Direct" : "Job activity"}
                    </span>
                  </div>
                  <p className="text-subtle text-xs mt-0.5">
                    {new Date(a.logged_at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
