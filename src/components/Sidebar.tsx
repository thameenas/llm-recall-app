import { useEffect, useRef } from "react";

interface SidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sourceFilter: "all" | "claude-code" | "cursor";
  onSourceFilterChange: (source: "all" | "claude-code" | "cursor") => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  totalCount: number;
  filteredCount: number;
}

const sources = [
  { value: "all" as const, label: "All" },
  { value: "claude-code" as const, label: "Claude Code" },
  { value: "cursor" as const, label: "Cursor" },
];

export default function Sidebar({
  searchQuery,
  onSearchChange,
  sourceFilter,
  onSourceFilterChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  totalCount,
  filteredCount,
}: SidebarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  // Cmd+F focuses the search bar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <aside className="w-64 border-r border-zinc-800 flex flex-col p-4 gap-4 shrink-0">
      <h1 className="text-lg font-semibold text-zinc-100">Recall</h1>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search... (⌘F)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
      </div>

      {/* Source filter */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Source</p>
        <div className="flex flex-col gap-1">
          {sources.map((s) => (
            <button
              key={s.value}
              onClick={() => onSourceFilterChange(s.value)}
              className={`text-left text-sm px-3 py-1.5 rounded-md transition-colors ${
                sourceFilter === s.value
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date range */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Date Range</p>
        {!(dateFrom || dateTo) ? (
          <button
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              onDateToChange(today);
            }}
            className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-md hover:bg-zinc-900 text-left w-full"
          >
            + Add date filter
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 [color-scheme:dark]"
              />
            </div>
            <button
              onClick={() => { onDateFromChange(""); onDateToChange(""); }}
              className="text-xs text-zinc-500 hover:text-zinc-300 text-left"
            >
              Clear dates
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-auto text-xs text-zinc-600">
        {filteredCount === totalCount
          ? `${totalCount} conversations`
          : `${filteredCount} of ${totalCount} conversations`}
      </div>
    </aside>
  );
}
