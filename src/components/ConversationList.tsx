import { Conversation } from "../lib/types";

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  selectedId: string | null;
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
  onSelect,
}: ConversationListProps) {
  if (loading) {
    return (
      <div className="w-[360px] border-r border-zinc-800 shrink-0 overflow-y-auto">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="w-[360px] border-r border-zinc-800 shrink-0 overflow-y-auto">
      {conversations.length === 0 ? (
        <div className="p-6 text-center text-zinc-500 text-sm">
          No conversations found
        </div>
      ) : (
        <div className="flex flex-col">
          {conversations.map((c) => (
            <button
              key={`${c.source}-${c.id}`}
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
  );
}
