import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, Users, FolderKanban } from "lucide-react";
import { useGlobalSearch, type SearchResultItem, type SearchResultType } from "../../hooks/useGlobalSearch";

const GROUPS: { type: SearchResultType; label: string; icon: typeof Building2 }[] = [
  { type: "company", label: "Companies", icon: Building2 },
  { type: "contact", label: "Contacts", icon: Users },
  { type: "opportunity", label: "Opportunities", icon: FolderKanban },
];

const PATH_BY_TYPE: Record<SearchResultType, string> = {
  company: "/companies",
  contact: "/contacts",
  opportunity: "/opp",
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { results, loading, hasQuery } = useGlobalSearch(query);

  const flat: SearchResultItem[] = [
    ...results.companies,
    ...results.contacts,
    ...results.opportunities,
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const selectResult = (item: SearchResultItem) => {
    navigate(`${PATH_BY_TYPE[item.type]}/${item.id}`);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flat.length > 0) setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length > 0) setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[activeIndex];
      if (item) selectResult(item);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = open && hasQuery;
  let rowIndex = -1;

  return (
    <div ref={containerRef} className="w-full max-w-sm relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => {
          if (hasQuery) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="w-full bg-shell-light border border-shell-border rounded-lg pl-9 pr-16 py-2 text-sm text-white
                   placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand/40"
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-subtle bg-shell-border/60 rounded px-1.5 py-0.5 font-mono">
        Ctrl K
      </span>

      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-11 bg-card border border-card-border rounded-xl p-2 z-50 max-h-96 overflow-y-auto"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {loading && <p className="text-xs text-subtle px-2 py-2">Searching…</p>}

          {!loading && flat.length === 0 && (
            <p className="text-xs text-subtle px-2 py-2">No matches for "{query.trim()}"</p>
          )}

          {!loading &&
            (
              [
                { group: GROUPS[0], items: results.companies },
                { group: GROUPS[1], items: results.contacts },
                { group: GROUPS[2], items: results.opportunities },
              ] as const
            ).map(({ group, items }) => {
              if (items.length === 0) return null;
              const Icon = group.icon;
              return (
                <div key={group.type} className="mb-1 last:mb-0">
                  <p className="text-[10px] uppercase tracking-wide text-subtle px-2 py-1">{group.label}</p>
                  {items.map((item) => {
                    rowIndex += 1;
                    const isActive = rowIndex === activeIndex;
                    return (
                      <button
                        key={item.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectResult(item)}
                        onMouseEnter={() => setActiveIndex(rowIndex)}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors
                          ${isActive ? "bg-shell-light" : "hover:bg-shell-light"}`}
                      >
                        <Icon size={14} className="text-subtle shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-white truncate">{item.title}</span>
                          {item.subtitle && (
                            <span className="block text-xs text-subtle truncate">{item.subtitle}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
