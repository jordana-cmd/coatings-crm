import type { ReactNode } from "react";
import { useAuth } from "../../hooks/useAuth";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

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

      {/* Bottom nav — stubbed */}
      <nav className="bg-white border-t border-gray-200 px-4 py-2 flex justify-around text-xs text-gray-400">
        <span>Today</span>
        <span>Calendar</span>
        <span>Pipeline</span>
        <span>Dashboard</span>
      </nav>
    </div>
  );
}
