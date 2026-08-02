"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  id: string;
  title: string;
  active: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

const LONG_PRESS_MS = 500;

export default function ConversationItem({ id, title, active, onSelect, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const closeMenu = () => {
    setMenuOpen(false);
    setConfirming(false);
  };

  const submitRename = () => {
    const t = draft.trim();
    if (t && t !== title) onRename(id, t);
    setEditing(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onTouchStart = () => {
    if (editing) return;
    longPressFired.current = false;
    clearLongPressTimer();
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setConfirming(false);
      setMenuOpen(true);
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
  };

  const handleRowClick = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (!editing && !menuOpen) onSelect(id);
  };

  return (
    <div
      className={
        "relative flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm cursor-pointer min-h-[44px] select-none " +
        (active ? "bg-[#161b22] text-white" : "text-[#8b949e] hover:bg-[#161b22] hover:text-white")
      }
      onClick={handleRowClick}
      onTouchStart={onTouchStart}
      onTouchEnd={clearLongPressTimer}
      onTouchMove={clearLongPressTimer}
      onTouchCancel={clearLongPressTimer}
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
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-[#0b0f14] border border-[#4f8cff] rounded px-1.5 py-0.5 text-sm text-white focus:outline-none"
        />
      ) : (
        <span className="flex-1 truncate">{title}</span>
      )}

      {!editing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
            setMenuOpen((v) => !v);
          }}
          className="hidden md:flex p-1 text-base leading-none text-[#6e7681] hover:text-white min-w-[28px] min-h-[28px] items-center justify-center rounded"
          aria-label="Conversation options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          ⋯
        </button>
      )}

      {menuOpen && !editing && (
        <div
          ref={menuRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-full mt-1 z-50 w-40 rounded-lg border border-[#30363d] bg-[#161b22] shadow-xl py-1 text-sm"
        >
          {confirming ? (
            <div className="px-3 py-2">
              <p className="text-xs text-[#8b949e] mb-2">Delete this chat?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    closeMenu();
                    onDelete(id);
                  }}
                  className="flex-1 px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 px-2 py-1 rounded text-[#8b949e] hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                role="menuitem"
                onClick={() => {
                  setDraft(title);
                  setEditing(true);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#1f2937] text-[#c9d1d9]"
              >
                Rename
              </button>
              <button
                role="menuitem"
                onClick={() => setConfirming(true)}
                className="w-full text-left px-3 py-2 hover:bg-[#1f2937] text-red-400"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
