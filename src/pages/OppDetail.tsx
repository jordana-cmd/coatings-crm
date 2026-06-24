import { useParams, useNavigate } from "react-router-dom";

export default function OppDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div>
      <button
        onClick={() => navigate("/")}
        className="text-sm text-blue-600 mb-4"
      >
        &larr; Back
      </button>
      <p className="text-gray-500 text-sm">
        Opportunity detail for <code className="text-gray-900">{id}</code> — coming next step.
      </p>
    </div>
  );
}
