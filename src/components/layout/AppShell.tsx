import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

function NavItem({ label, path, active }: { label: string; path: string; active: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className={`flex-1 py-2 text-center text-xs font-medium transition-colors
        ${active ? "text-brand" : "text-gray-400 active:text-gray-200"}`}
    >
      {label}
    </button>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-svh flex flex-col bg-body">
      {/* Header */}
      <header className="bg-shell px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-white text-sm tracking-tight">
          Motor City Floors
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 truncate max-w-[140px]">
            {user?.email}
          </span>
          <button
            onClick={signOut}
            className="text-xs text-brand font-medium active:text-brand-hover"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">{children}</main>

      {/* Bottom nav */}
      <nav className="bg-shell border-t border-shell-darker px-4 flex">
        <NavItem label="Today" path="/" active={location.pathname === "/"} />
        <NavItem label="Calendar" path="/calendar" active={location.pathname === "/calendar"} />
        <NavItem label="Opportunities" path="/opportunities" active={location.pathname === "/opportunities"} />
      </nav>
    </div>
  );
}
