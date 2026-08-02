"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import MessageBubble, { type UiMessage } from "@/components/MessageBubble";
import ConversationItem from "@/components/ConversationItem";
import SearchBox from "@/components/SearchBox";

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  lastMessagePreview: string | null;
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
  const [showJump, setShowJump] = useState(false);
  const messageRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setShowJump(false);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = (await res.json()) as { conversations: ConversationSummary[] };
        setConversations(data.conversations);
      }
    } catch {
      // ignore list failures
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Poll for changes made from other tabs/devices, and refresh immediately
  // when this tab regains focus/visibility.
  useEffect(() => {
    const POLL_MS = 5000;
    const id = setInterval(() => {
      void loadConversations();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadConversations();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [loadConversations]);

  // Smart auto-scroll: follow new messages only when near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
      setShowJump(false);
    }
  }, [messages, streaming]);

  // While streaming, reveal a jump-to-bottom button when the user scrolls up.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      setShowJump(streaming && !nearBottom);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [streaming]);

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
          sources: UiMessage["sources"];
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

  // Poll the open conversation for messages added elsewhere (e.g. another
  // device), but never while this tab is actively streaming a response.
  useEffect(() => {
    if (!currentId || streaming) return;
    const POLL_MS = 5000;
    const id = setInterval(() => {
      void loadMessages(currentId);
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadMessages(currentId);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [currentId, streaming, loadMessages]);

  const newChat = useCallback(() => {
    messageRef.current = null;
    setCurrentId(null);
    setMessages([]);
    setError(null);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    textareaRef.current?.focus();
  }, []);

  const send = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || streaming) return;
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
      const helper: UiMessage = { id: helperId, role: "assistant", content: "" };
      setMessages((prev) => [...prev, userMsg, helper]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: currentId,
            message: text,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
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
                conversationId?: string;
              };
              if (data.error) throw new Error(data.error);
              if (data.conversationId) {
                messageRef.current = data.conversationId;
                setCurrentId(data.conversationId);
                void loadConversations();
              }
              if (data.delta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === helperId ? { ...m, content: m.content + data.delta } : m,
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
        setMessages((prev) => prev.filter((m) => m.id !== helperId || m.content !== ""));
        void loadConversations();
        // Refresh source metadata after streaming completes.
        const resolvedId =
          currentId ?? messageRef.current ?? null;
        if (resolvedId) void loadMessages(resolvedId);
      }
    },
    [input, streaming, currentId, loadConversations, loadMessages],
  );

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

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        await fetch(`/api/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        await loadConversations();
      } catch {
        // ignore
      }
    },
    [loadConversations],
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

  // Keyboard shortcuts: Cmd/Ctrl+K search, Cmd/Ctrl+N new chat, Cmd+Enter send
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newChat();
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        if (!streaming) void send();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat, send, streaming]);

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

  const editMessage = useCallback(
    (text: string) => {
      setInput(text);
      textareaRef.current?.focus();
    },
    [],
  );

  const regenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      setMessages((prev) => prev.filter((m) => m.id !== prev[prev.length - 1].id));
      void send(lastUser.content);
    }
  }, [messages, send]);

  const onSearchSelect = useCallback(
    (hit: { type: string; conversationId: string | null }) => {
      if (hit.type === "message" && hit.conversationId) {
        selectConversation(hit.conversationId);
      } else if (hit.type === "memory") {
        window.location.href = "/memories";
      }
    },
    [selectConversation],
  );

  return (
    <div className="flex h-dvh overflow-hidden relative">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={
          "fixed inset-y-0 left-0 z-40 w-72 sm:w-64 flex flex-col border-r border-[#1f2937] bg-[#11161d] shadow-xl transition-transform duration-200 ease-out " +
          (sidebarOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="p-3 flex items-center gap-2">
          <button
            onClick={newChat}
            className="flex-1 px-3 py-2.5 rounded-lg bg-[#4f8cff] text-white text-sm font-medium hover:opacity-90 min-h-[44px]"
          >
            + New chat
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2.5 rounded-lg text-[#8b949e] hover:text-white min-h-[44px] min-w-[44px]"
            aria-label="Close sidebar"
          >
            X
          </button>
        </div>
        <div className="px-3 pb-2 space-y-1">
          <SearchBox onSelect={onSearchSelect} inputRef={searchRef} />
          <Link
            href="/memories"
            className="block px-3 py-2.5 rounded-lg text-sm text-[#8b949e] hover:bg-[#161b22] hover:text-white min-h-[44px] flex items-center"
          >
            Memories
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {conversations.map((c) => (
            <ConversationItem
              key={c.id}
              id={c.id}
              title={c.title}
              active={c.id === currentId}
              onSelect={selectConversation}
              onRename={renameConversation}
              onDelete={deleteConversation}
            />
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#6e7681]">No conversations yet</p>
          )}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 w-full">
        <header className="flex items-center gap-2 px-3 sm:px-4 h-12 border-b border-[#1f2937] shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="px-2 py-2 text-sm text-[#8b949e] hover:text-white rounded min-h-[40px] min-w-[40px]"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? "X" : "="}
          </button>
          <h1 className="text-sm font-medium truncate">Personal AI Assistant</h1>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4">
            {messages.length === 0 && (
              <div className="py-12 sm:py-16 text-center text-[#6e7681]">
                <p className="text-lg mb-2">Ask me anything</p>
                <p className="text-sm px-4">
                  I remember our past conversations and can search the web for current facts.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                message={m}
                isLastAssistant={m.role === "assistant" && i === messages.length - 1}
                onEdit={m.role === "user" ? editMessage : undefined}
                onRegenerate={m.role === "assistant" && i === messages.length - 1 ? regenerate : undefined}
              />
            ))}

            {streaming && (
              <div className="flex items-center gap-2 py-2 text-xs text-[#6e7681]">
                <span className="inline-block w-2 h-2 rounded-full bg-[#4f8cff] animate-pulse" />
                Streaming
              </div>
            )}

            {error && <div className="py-2 text-sm text-red-400">{error}</div>}
            {showJump && (
              <button
                onClick={scrollToBottom}
                className="sticky bottom-2 mx-auto block px-3 py-1.5 rounded-full bg-[#4f8cff] text-white text-xs font-medium shadow-lg"
              >
                down
              </button>
            )}
          </div>
        </div>

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
                disabled={!input.trim()}
                className="px-4 py-2.5 rounded-lg bg-[#4f8cff] text-white text-sm font-medium disabled:opacity-40 min-h-[44px] shrink-0"
              >
                Send
              </button>
            )}
          </div>
          {!currentId && (
            <p className="max-w-3xl mx-auto mt-2 text-xs text-[#6e7681] px-1">
              Type a message to start a new conversation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}