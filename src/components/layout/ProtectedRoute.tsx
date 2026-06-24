import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import type { ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-body">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-brand" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
