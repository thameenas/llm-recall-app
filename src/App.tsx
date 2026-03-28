import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Conversation, Message } from "./lib/types";
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

  // Filter conversations
  const filtered = conversations.filter((c) => {
    if (sourceFilter !== "all" && c.source !== sourceFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q) ||
        c.project.toLowerCase().includes(q)
      );
    }
    return true;
  });

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
