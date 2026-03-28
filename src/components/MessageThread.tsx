import { Conversation, Message } from "../lib/types";

interface MessageThreadProps {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-zinc-700 text-zinc-100"
            : "bg-zinc-900 text-zinc-200"
        }`}
      >
        <p className="text-xs text-zinc-500 mb-1">
          {isUser ? "You" : "Assistant"}
        </p>
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
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
        <h2 className="text-sm font-medium text-zinc-200 truncate">
          {conversation.preview}
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          {conversation.project.split("/").pop()} · {conversation.message_count} messages
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <LoadingSkeleton />
        ) : messages.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm mt-8">
            No messages found
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <MessageBubble key={m.id || i} message={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
