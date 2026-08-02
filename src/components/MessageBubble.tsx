"use client";
import { useState } from "react";
import Markdown from "@/components/Markdown";

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  searchUsed?: boolean;
  sources?: Source[];
  createdAt?: string;
}

interface Props {
  message: UiMessage;
  isLastAssistant?: boolean;
  onEdit?: (text: string) => void;
  onRegenerate?: () => void;
}

export default function MessageBubble({ message, isLastAssistant, onEdit, onRegenerate }: Props) {
  const [showSources, setShowSources] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const isUser = message.role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      // ignore
    }
  };

  const submitEdit = () => {
    const t = editText.trim();
    if (t && t !== message.content && onEdit) onEdit(t);
    setEditing(false);
  };

  return (
    <div className={"flex gap-2 sm:gap-3 py-3 " + (isUser ? "flex-row-reverse" : "")}>
      <div
        className={
          "group relative min-w-0 max-w-[92%] sm:max-w-[85%] rounded-xl px-3 py-2 sm:px-4 " +
          (isUser ? "bg-[#1f3a5f] text-white" : "bg-[#11161d] border border-[#1f2937]")
        }
      >
        {!isUser && (
          <div className="flex flex-wrap items-center gap-2 mb-1 text-xs text-[#6e7681]">
            <span>Assistant</span>
            {message.searchUsed && (
              <span className="text-[#4f8cff]">searched web</span>
            )}
          </div>
        )}

        <div className="text-sm sm:text-base break-words">
          {editing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitEdit();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
              rows={Math.min(Math.max(Math.ceil(message.content.length / 40), 2), 8)}
              className="w-full resize-none px-2 py-1.5 rounded bg-[#0b0f14] border border-[#30363d] text-sm focus:outline-none focus:border-[#4f8cff]"
            />
          ) : (
            <Markdown content={message.content} />
          )}
        </div>

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 text-xs">
            <button
              onClick={() => setShowSources((v) => !v)}
              className="text-[#8b949e] hover:text-[#4f8cff] py-1 min-h-[32px]"
            >
              {showSources ? "hide sources" : "show sources"} ({message.sources.length})
            </button>
            {showSources && (
              <ol className="mt-2 space-y-1 list-decimal list-inside">
                {message.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#4f8cff] hover:underline break-all">
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {!editing && (
          <div className={"absolute -top-2.5 hidden group-hover:flex gap-1 " + (isUser ? "left-2" : "right-2")}>
            {isUser && (
              <button
                onClick={() => setEditing(true)}
                className="px-2 py-1 rounded text-[10px] bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d]"
              >
                edit
              </button>
            )}
            {!isUser && isLastAssistant && (
              <button
                onClick={onRegenerate}
                className="px-2 py-1 rounded text-[10px] bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d]"
              >
                retry
              </button>
            )}
            <button
              onClick={() => void copy()}
              className="px-2 py-1 rounded text-[10px] bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d]"
            >
              copy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}