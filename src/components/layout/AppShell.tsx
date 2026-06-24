import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

function NavItem({ label, path, active }: { label: string; path: string; active: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className={`flex-1 py-1 text-center ${active ? "text-gray-900 font-medium" : "text-gray-400"}`}
    >
      {label}
    </button>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-svh flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-gray-900">Coatings CRM</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 truncate max-w-[180px]">
            {user?.email}
          </span>
          <button
            onClick={signOut}
            className="text-sm text-red-600 font-medium active:text-red-800"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">{children}</main>

      {/* Bottom nav */}
      <nav className="bg-white border-t border-gray-200 px-4 py-2 flex text-xs">
        <NavItem label="Today" path="/" active={location.pathname === "/"} />
        <NavItem label="Calendar" path="/calendar" active={location.pathname === "/calendar"} />
        <NavItem label="Opportunities" path="/opportunities" active={location.pathname === "/opportunities"} />
      </nav>
    </div>
  );
}
