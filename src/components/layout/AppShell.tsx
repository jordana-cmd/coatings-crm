import { useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Sun,
  Building2,
  Users,
  BarChart3,
  Search,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Today", path: "/", icon: Sun },
  { label: "Opportunities", path: "/opportunities", icon: FolderKanban },
  { label: "Companies", path: "/companies", icon: Building2 },
  { label: "Contacts", path: "/contacts", icon: Users },
  { label: "Reports", path: "/reports", icon: BarChart3 },
  { label: "Calendar", path: "/calendar", icon: CalendarDays },
];

function SidebarContent({ current, onNav }: { current: string; onNav: (p: string) => void }) {
  return (
    <>
      <div className="px-5 py-6">
        <p className="text-white font-bold text-sm leading-tight">Motor City</p>
        <p className="text-brand text-xs font-semibold">Floors & Coatings</p>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = current === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => onNav(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? "bg-shell-light text-white border-l-2 border-brand"
                  : "text-subtle hover:bg-shell-hover hover:text-white"
                }`}
            >
              <Icon size={18} className={active ? "text-brand" : ""} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const initial = (user?.email ?? "U")[0].toUpperCase();

  return (
    <div className="min-h-svh flex bg-page">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 bg-shell border-r border-shell-border">
        <SidebarContent current={location.pathname} onNav={handleNav} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-shell flex flex-col">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-subtle">
              <X size={20} />
            </button>
            <SidebarContent current={location.pathname} onNav={handleNav} />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col md:ml-56">
        {/* Top bar */}
        <header className="bg-shell border-b border-shell-border px-4 py-3 flex items-center gap-4">
          <button className="md:hidden text-subtle shrink-0" onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>

          {/* Spacer left */}
          <div className="flex-1" />

          {/* Centered search */}
          <div className="w-full max-w-sm relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-shell-light border border-shell-border rounded-lg pl-9 pr-16 py-2 text-sm text-white
                         placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-subtle bg-shell-border/60 rounded px-1.5 py-0.5 font-mono">
              Ctrl K
            </span>
          </div>

          {/* Spacer right */}
          <div className="flex-1" />

          {/* Right icons */}
          <div className="flex items-center gap-1 shrink-0">
            <button className="p-2 text-subtle hover:text-white rounded-lg hover:bg-shell-light transition-colors">
              <Bell size={18} />
            </button>
            <button className="p-2 text-subtle hover:text-white rounded-lg hover:bg-shell-light transition-colors">
              <Settings size={18} />
            </button>
            <div className="relative ml-1">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center text-sm font-semibold
                           ring-2 ring-brand/20"
              >
                {initial}
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-11 bg-card border border-card-border rounded-xl p-3 w-56 z-50"
                     style={{ boxShadow: "var(--shadow-card)" }}>
                  <p className="text-xs text-label truncate mb-2 px-1">{user?.email}</p>
                  <button
                    onClick={() => { signOut(); setProfileOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-2 text-sm text-brand hover:bg-brand-light rounded-lg transition-colors"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-shell border-t border-shell-border flex z-40">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium
                ${active ? "text-brand" : "text-subtle"}`}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
