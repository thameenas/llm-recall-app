import { useEffect, useRef } from "react";
import { Conversation } from "../lib/types";

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  selectedId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: (id: string, source: string) => void;
}

function formatRelativeDate(epochMs: number): string {
  const now = Date.now();
  const diff = now - epochMs;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(epochMs).toLocaleDateString();
}

function SourceBadge({ source }: { source: string }) {
  const isClaudeCode = source === "claude-code";
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
        isClaudeCode
          ? "bg-orange-900/40 text-orange-400"
          : "bg-blue-900/40 text-blue-400"
      }`}
    >
      {isClaudeCode ? "Claude Code" : "Cursor"}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse flex flex-col gap-2 p-3 rounded-lg bg-zinc-900">
          <div className="h-3 bg-zinc-800 rounded w-16" />
          <div className="h-4 bg-zinc-800 rounded w-3/4" />
          <div className="h-3 bg-zinc-800 rounded w-full" />
        </div>
      ))}
    </div>
  );
}

export default function ConversationList({
  conversations,
  loading,
  selectedId,
  collapsed,
  onToggleCollapse,
  onSelect,
}: ConversationListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation: Up/Down to move, Enter to select
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIndex = conversations.findIndex(
          (c) => c.id === selectedId
        );

        let nextIndex: number;
        if (e.key === "ArrowDown") {
          nextIndex = currentIndex < conversations.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : conversations.length - 1;
        }

        const next = conversations[nextIndex];
        if (next) {
          onSelect(next.id, next.source);
          // Scroll the selected item into view
          const el = document.getElementById(`conv-${next.source}-${next.id}`);
          el?.scrollIntoView({ block: "nearest" });
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [conversations, selectedId, onSelect]);

  return (
    <div className="relative flex shrink-0">
      {/* Toggle button */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-3 z-10 bg-zinc-800 border border-zinc-700 rounded-full w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
        title={collapsed ? "Show conversation list" : "Hide conversation list"}
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={collapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
          />
        </svg>
      </button>

      <div
        ref={listRef}
        className={`border-r border-zinc-800 overflow-y-auto transition-all duration-200 ${
          collapsed ? "w-0 overflow-hidden" : "w-[360px]"
        }`}
      >
        {loading ? (
          <LoadingSkeleton />
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 text-sm w-[360px]">
            No conversations found
          </div>
        ) : (
          <div className="flex flex-col w-[360px]">
            {conversations.map((c) => (
              <button
                key={`${c.source}-${c.id}`}
                id={`conv-${c.source}-${c.id}`}
                onClick={() => onSelect(c.id, c.source)}
                className={`text-left p-3 border-b border-zinc-800/50 transition-colors ${
                  selectedId === c.id
                    ? "bg-zinc-800"
                    : "hover:bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <SourceBadge source={c.source} />
                  <span className="text-[11px] text-zinc-500">
                    {formatRelativeDate(c.created_at)}
                  </span>
                </div>
                <p className="text-sm text-zinc-200 truncate">{c.preview}</p>
                <p className="text-xs text-zinc-500 mt-1 truncate">
                  {c.project.split("/").pop() || c.project} · {c.message_count} messages
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
