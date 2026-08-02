"use client";
import { useState } from "react";

interface Props {
  id: string;
  title: string;
  active: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export default function ConversationItem({ id, title, active, onSelect, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [confirming, setConfirming] = useState(false);

  const submitRename = () => {
    const t = draft.trim();
    if (t && t !== title) onRename(id, t);
    setEditing(false);
  };

  return (
    <div
      className={"group flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm cursor-pointer min-h-[44px] " + (active ? "bg-[#161b22] text-white" : "text-[#8b949e] hover:bg-[#161b22] hover:text-white")}
      onClick={() => {
        if (!editing && !confirming) onSelect(id);
      }}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitRename();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1 min-w-0 bg-[#0b0f14] border border-[#4f8cff] rounded px-1.5 py-0.5 text-sm text-white focus:outline-none"
        />
      ) : (
        <span className="flex-1 truncate">{title}</span>
      )}

      {confirming ? (
        <span className="flex items-center gap-1 text-xs">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(false);
              onDelete(id);
            }}
            className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
          >
            yes
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(false);
            }}
            className="px-1.5 py-0.5 rounded text-[#8b949e] hover:text-white"
          >
            no
          </button>
        </span>
      ) : !editing ? (
        <span className="flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDraft(title);
              setEditing(true);
            }}
            className="p-1 text-xs text-[#6e7681] hover:text-white min-w-[28px] min-h-[28px]"
            aria-label="Rename conversation"
          >
            R
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
            }}
            className="p-1 text-xs text-[#6e7681] hover:text-red-400 min-w-[28px] min-h-[28px]"
            aria-label="Delete conversation"
          >
            X
          </button>
        </span>
      ) : null}
    </div>
  );
}