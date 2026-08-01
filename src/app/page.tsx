"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import SearchBox from "@/components/SearchBox";

interface Source {
  title: string;
  url: string;
  snippet: string;
}

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  searchUsed?: boolean;
  sources?: Source[];
  createdAt?: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  lastMessagePreview: string | null;
}

function MessageBubble({ message }: { message: UiMessage }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === "user";

  return (
    <div
      className={
        "flex gap-2 sm:gap-3 py-3 " + (isUser ? "flex-row-reverse" : "")
      }
    >
      <div
        className={
          "min-w-0 max-w-[92%] sm:max-w-[85%] rounded-xl px-3 py-2 sm:px-4 " +
          (isUser
            ? "bg-[#1f3a5f] text-white"
            : "bg-[#11161d] border border-[#1f2937]")
        }
      >
        {!isUser && (
          <div className="flex flex-wrap items-center gap-2 mb-1 text-xs text-[#6e7681]">
            <span>Assistant</span>
            {message.searchUsed && (
              <span className="inline-flex items-center gap-1 text-[#4f8cff]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                searched web
              </span>
            )}
          </div>
        )}

        <div className="text-sm sm:text-base break-words">
          <Markdown content={message.content} />
        </div>

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 text-xs">
            <button
              onClick={() => setShowSources((v) => !v)}
              className="text-[#8b949e] hover:text-[#4f8cff] py-1 min-h-[32px]"
            >
              {showSources ? "hide sources" : "show sources"} (
              {message.sources.length})
            </button>
            {showSources && (
              <ol className="mt-2 space-y-1 list-decimal list-inside">
                {message.sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#4f8cff] hover:underline break-all"
                    >
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => scrollToBottom(), [messages, scrollToBottom]);

  // Open sidebar by default on desktop widths only.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setSidebarOpen(true);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = (await res.json()) as {
          conversations: ConversationSummary[];
        };
        setConversations(data.conversations);
      }
    } catch {
      // ignore list failures
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: Array<{
          id: string;
          role: string;
          content: string;
          createdAt: string;
          searchUsed: boolean;
          sources: Source[];
        }>;
      };
      setMessages(
        data.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            searchUsed: m.searchUsed,
            sources: m.sources ?? [],
            createdAt: m.createdAt,
          })),
      );
    } catch {
      // ignore
    }
  }, []);

  const newChat = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as { conversation: { id: string } };
      setCurrentId(data.conversation.id);
      setMessages([]);
      await loadConversations();
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    } catch {
      // ignore
    }
  }, [loadConversations]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !currentId) return;
    setInput("");
    setError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: UiMessage = {
      id: "user-" + Date.now(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const helperId = "assistant-stream";
    const helper: UiMessage = {
      id: helperId,
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, userMsg, helper]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: currentId, message: text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Chat request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              delta?: string;
              done?: boolean;
              error?: string;
            };
            if (data.error) throw new Error(data.error);
            if (data.delta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === helperId
                    ? { ...m, content: m.content + data.delta }
                    : m,
                ),
              );
            }
            if (data.done) break;
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setStreaming(false);
      abortRef.current = null;
      setMessages((prev) =>
        prev.filter((m) => m.id !== helperId || m.content !== ""),
      );
      await loadConversations();
      if (currentId) await loadMessages(currentId);
    }
  }, [input, streaming, currentId, loadConversations, loadMessages]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const selectConversation = useCallback(
    (id: string) => {
      setCurrentId(id);
      void loadMessages(id);
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    },
    [loadMessages],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        if (id === currentId) {
          setCurrentId(null);
          setMessages([]);
        }
        await loadConversations();
      } catch {
        // ignore
      }
    },
    [currentId, loadConversations],
  );

  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send],
  );

  return (
    <div className="flex h-dvh overflow-hidden relative">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={
          "fixed md:static inset-y-0 left-0 z-40 w-72 sm:w-64 shrink-0 flex flex-col border-r border-[#1f2937] bg-[#11161d] transition-transform duration-200 ease-out " +
          (sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0 md:hidden")
        }
      >
        <div className="p-3 flex items-center gap-2">
          <button
            onClick={() => void newChat()}
            className="flex-1 px-3 py-2.5 rounded-lg bg-[#4f8cff] text-white text-sm font-medium hover:opacity-90 min-h-[44px]"
          >
            + New chat
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2.5 rounded-lg text-[#8b949e] hover:text-white min-h-[44px] min-w-[44px]"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>
        <div className="px-3 pb-2 space-y-1">
          <SearchBox />
          <Link
            href="/memories"
            className="block px-3 py-2.5 rounded-lg text-sm text-[#8b949e] hover:bg-[#161b22] hover:text-white min-h-[44px] flex items-center"
          >
            Memories
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={
                "group flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm cursor-pointer min-h-[44px] " +
                (c.id === currentId
                  ? "bg-[#161b22] text-white"
                  : "text-[#8b949e] hover:bg-[#161b22] hover:text-white")
              }
              onClick={() => selectConversation(c.id)}
            >
              <span className="flex-1 truncate">{c.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteConversation(c.id);
                }}
                className="opacity-60 md:opacity-0 group-hover:opacity-100 text-xs text-[#6e7681] hover:text-red-400 min-h-[32px] min-w-[32px]"
                aria-label="Delete conversation"
              >
                x
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#6e7681]">
              No conversations yet
            </p>
          )}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <header className="flex items-center gap-2 px-3 sm:px-4 h-12 border-b border-[#1f2937] shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="px-2 py-2 text-sm text-[#8b949e] hover:text-white rounded min-h-[40px] min-w-[40px]"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>
          <h1 className="text-sm font-medium truncate">Personal AI Assistant</h1>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4">
            {messages.length === 0 && (
              <div className="py-12 sm:py-16 text-center text-[#6e7681]">
                <p className="text-lg mb-2">Ask me anything</p>
                <p className="text-sm px-4">
                  I remember our past conversations and can search the web for
                  current facts.
                </p>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}

            {streaming && (
              <div className="flex items-center gap-2 py-2 text-xs text-[#6e7681]">
                <span className="inline-block w-2 h-2 rounded-full bg-[#4f8cff] animate-pulse" />
                Streaming
              </div>
            )}

            {error && <div className="py-2 text-sm text-red-400">{error}</div>}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-[#1f2937] p-2.5 sm:p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.625rem)]">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoGrow();
              }}
              onKeyDown={onKeyDown}
              placeholder="Message..."
              rows={1}
              disabled={!currentId}
              className="flex-1 resize-none px-3 py-2.5 rounded-lg bg-[#11161d] border border-[#30363d] text-base sm:text-sm focus:outline-none focus:border-[#4f8cff] max-h-[200px]"
              style={{ fontSize: "16px" }}
            />
            {streaming ? (
              <button
                onClick={stop}
                className="px-4 py-2.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 min-h-[44px] shrink-0"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={() => void send()}
                disabled={!currentId || !input.trim()}
                className="px-4 py-2.5 rounded-lg bg-[#4f8cff] text-white text-sm font-medium disabled:opacity-40 min-h-[44px] shrink-0"
              >
                Send
              </button>
            )}
          </div>
          {!currentId && (
            <p className="max-w-3xl mx-auto mt-2 text-xs text-[#6e7681] px-1">
              Use &quot;+ New chat&quot; to start a conversation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
