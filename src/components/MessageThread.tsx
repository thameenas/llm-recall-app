import { useEffect, useRef, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDebounce } from "../hooks/useDebounce";
import { Conversation, Message } from "../lib/types";

interface MessageThreadProps {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
}

// Cache for markdown-to-HTML conversions to avoid repeated Rust calls
const htmlCache = new Map<string, string>();

async function renderMarkdown(text: string): Promise<string> {
  const cached = htmlCache.get(text);
  if (cached) return cached;

  const html = await invoke<string>("markdown_to_html", { text });
  htmlCache.set(text, html);
  return html;
}

/**
 * Highlights all occurrences of `query` in `text` by wrapping matches
 * in a <mark> tag. Returns an array of React nodes.
 */
function highlightText(text: string, query: string): React.ReactNode[] {
  if (!query) return [text];

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function MarkdownContent({ content }: { content: string }) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    renderMarkdown(content).then(setHtml);
  }, [content]);

  if (!html) return <div className="text-sm text-zinc-400">Rendering...</div>;

  return (
    <div
      className="text-sm prose prose-invert prose-sm max-w-none prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-700 prose-code:text-emerald-400 prose-headings:text-zinc-100 prose-p:text-zinc-200 prose-a:text-blue-400 prose-strong:text-zinc-100 prose-li:text-zinc-200 prose-table:border-collapse prose-th:border prose-th:border-zinc-700 prose-th:px-3 prose-th:py-1.5 prose-th:bg-zinc-800 prose-td:border prose-td:border-zinc-700 prose-td:px-3 prose-td:py-1.5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function MessageBubble({ message, searchQuery }: { message: Message; searchQuery: string }) {
  const isUser = message.role === "user";
  const isMatch = searchQuery && message.content.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-zinc-700 text-zinc-100"
            : "bg-zinc-900 text-zinc-200 border border-zinc-800"
        } ${isMatch ? "ring-2 ring-yellow-500/60" : ""}`}
      >
        <p className={`text-[11px] font-medium mb-1.5 ${isUser ? "text-zinc-400" : "text-emerald-500"}`}>
          {isUser ? "You" : "Assistant"}
        </p>
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap break-words">
            {searchQuery ? highlightText(message.content, searchQuery) : message.content}
          </div>
        ) : (
          <MarkdownContent content={message.content} />
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}
        >
          <div className="bg-zinc-900 rounded-lg p-4 w-3/4">
            <div className="h-3 bg-zinc-800 rounded w-16 mb-2" />
            <div className="h-3 bg-zinc-800 rounded w-full mb-1" />
            <div className="h-3 bg-zinc-800 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MessageThread({
  conversation,
  messages,
  loading,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 200);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Reset search when conversation changes
  useEffect(() => {
    setSearchQuery("");
    setCurrentMatchIndex(0);
    scrollRef.current?.scrollTo(0, 0);
  }, [conversation?.id]);

  // Cmd+F focuses the in-conversation search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Find matching message indices
  const matchIndices = useMemo(() => {
    if (!debouncedQuery) return [];
    const q = debouncedQuery.toLowerCase();
    return messages
      .map((m, i) => (m.content.toLowerCase().includes(q) ? i : -1))
      .filter((i) => i !== -1);
  }, [messages, debouncedQuery]);

  // Scroll to current match
  useEffect(() => {
    if (matchIndices.length === 0) return;
    const idx = matchIndices[currentMatchIndex];
    const el = document.getElementById(`message-${idx}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentMatchIndex, matchIndices]);

  // Reset match index when query changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [debouncedQuery]);

  function goToNextMatch() {
    if (matchIndices.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matchIndices.length);
  }

  function goToPrevMatch() {
    if (matchIndices.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matchIndices.length) % matchIndices.length);
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600">
        <div className="text-center">
          <p className="text-lg">Select a conversation</p>
          <p className="text-sm mt-1">Choose from the list on the left</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-3 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-zinc-200 truncate">
              {conversation.title}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {conversation.project.split("/").pop()} · {conversation.message_count} messages
            </p>
          </div>

          {/* In-conversation search */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <svg
                className="absolute left-2 top-2 h-3.5 w-3.5 text-zinc-500"
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
                ref={searchInputRef}
                type="text"
                placeholder="Find in conversation... (⌘F)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.shiftKey ? goToPrevMatch() : goToNextMatch();
                  }
                  if (e.key === "Escape") {
                    setSearchQuery("");
                  }
                }}
                className="w-48 pl-7 pr-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>
            {debouncedQuery && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                  {matchIndices.length === 0
                    ? "No matches"
                    : `${currentMatchIndex + 1}/${matchIndices.length}`}
                </span>
                <button
                  onClick={goToPrevMatch}
                  disabled={matchIndices.length === 0}
                  className="p-1 text-zinc-400 hover:text-zinc-200 disabled:text-zinc-700"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={goToNextMatch}
                  disabled={matchIndices.length === 0}
                  className="p-1 text-zinc-400 hover:text-zinc-200 disabled:text-zinc-700"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <LoadingSkeleton />
        ) : messages.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm mt-8">
            No messages found
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <div key={m.id || i} id={`message-${i}`}>
                <MessageBubble message={m} searchQuery={debouncedQuery} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
