import { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Conversation, Message } from "./lib/types";
import { search } from "./lib/search";
import { useDebounce } from "./hooks/useDebounce";
import Sidebar from "./components/Sidebar";
import ConversationList from "./components/ConversationList";
import MessageThread from "./components/MessageThread";

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "claude-code" | "cursor">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Debounce search by 200ms so we don't search on every keystroke
  const debouncedQuery = useDebounce(searchQuery, 200);

  // Load all conversations on startup
  useEffect(() => {
    invoke<Conversation[]>("list_conversations")
      .then((data) => {
        setConversations(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load conversations:", err);
        setLoading(false);
      });
  }, []);

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!selectedId || !selectedSource) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    invoke<Message[]>("get_messages", { id: selectedId, source: selectedSource })
      .then((data) => {
        setMessages(data);
        setMessagesLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load messages:", err);
        setMessagesLoading(false);
      });
  }, [selectedId, selectedSource]);

  // Filter conversations using MiniSearch + source + date filters
  const filtered = useMemo(() => {
    // Get search results (null means "no query, show all")
    const searchMatches = search(debouncedQuery, conversations);

    // Parse date boundaries
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toMs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : Infinity;

    return conversations.filter((c) => {
      // Source filter
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;

      // Date filter
      if (c.created_at < fromMs || c.created_at > toMs) return false;

      // Search filter — if there's a query, only show matches
      if (searchMatches !== null) {
        return searchMatches.has(`${c.source}-${c.id}`);
      }

      return true;
    });
  }, [conversations, debouncedQuery, sourceFilter, dateFrom, dateTo]);

  const selectedConversation = conversations.find(
    (c) => c.id === selectedId && c.source === selectedSource
  );

  return (
    <div className="flex h-screen">
      {/* Left sidebar: search + filters */}
      <Sidebar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        totalCount={conversations.length}
        filteredCount={filtered.length}
      />

      {/* Middle panel: conversation list */}
      <ConversationList
        conversations={filtered}
        loading={loading}
        selectedId={selectedId}
        onSelect={(id, source) => {
          setSelectedId(id);
          setSelectedSource(source);
        }}
      />

      {/* Right panel: message thread */}
      <MessageThread
        conversation={selectedConversation ?? null}
        messages={messages}
        loading={messagesLoading}
      />
    </div>
  );
}

export default App;
