import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
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
            : "bg-zinc-900 text-zinc-200 border border-zinc-800"
        }`}
      >
        <p className={`text-[11px] font-medium mb-1.5 ${isUser ? "text-zinc-400" : "text-emerald-500"}`}>
          {isUser ? "You" : "Assistant"}
        </p>
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        ) : (
          <div className="text-sm prose prose-invert prose-sm max-w-none prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-700 prose-code:text-emerald-400 prose-headings:text-zinc-100 prose-p:text-zinc-200 prose-a:text-blue-400 prose-strong:text-zinc-100 prose-li:text-zinc-200 prose-table:border-collapse prose-th:border prose-th:border-zinc-700 prose-th:px-3 prose-th:py-1.5 prose-th:bg-zinc-800 prose-td:border prose-td:border-zinc-700 prose-td:px-3 prose-td:py-1.5">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content}
            </ReactMarkdown>
          </div>
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

  // Scroll to top when conversation changes
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [conversation?.id]);

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
              <MessageBubble key={m.id || i} message={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
