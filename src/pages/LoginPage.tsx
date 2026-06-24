import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-shell">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-shell-border border-t-brand" />
      </div>
    );
  }

  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const err = await signIn(email, password);
    if (err) { setError(err); setSubmitting(false); }
  };

  return (
    <div className="min-h-svh flex items-center justify-center bg-page p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-card rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-heading">Motor City Floors</h1>
          <p className="text-xs text-brand font-semibold">& Coatings</p>
        </div>

        <label className="block mb-4">
          <span className="block text-xs font-medium text-label mb-1">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-heading
                       focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            autoComplete="email" />
        </label>

        <label className="block mb-6">
          <span className="block text-xs font-medium text-label mb-1">Password</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-heading
                       focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            autoComplete="current-password" />
        </label>

        {error && <p className="text-brand text-sm mb-4 text-center">{error}</p>}

        <button type="submit" disabled={submitting}
          className="w-full rounded-lg bg-brand text-white py-3 text-sm font-medium
                     active:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
