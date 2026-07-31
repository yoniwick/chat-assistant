"use client";

import { useRef, useState } from "react";

interface SearchHit {
  type: "message" | "memory";
  id: string;
  content: string;
  conversationTitle: string | null;
  role: string | null;
  kind: string | null;
  createdAt: string;
}

export default function SearchBox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    try {
      const res = await fetch("/api/search?q=" + encodeURIComponent(trimmed));
      if (res.ok) {
        const data = (await res.json()) as { results: SearchHit[] };
        setHits(data.results);
        setOpen(true);
      }
    } catch {
      // ignore
    }
  };

  const onChange = (value: string) => {
    setQ(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void doSearch(value), 300);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search everything"
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        className="w-full px-3 py-2 rounded-lg bg-[#0b0f14] border border-[#30363d] text-sm focus:outline-none focus:border-[#4f8cff]"
      />
      {open && hits.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-72 overflow-y-auto rounded-lg border border-[#30363d] bg-[#11161d] shadow-xl">
          {hits.slice(0, 20).map((h) => (
            <div
              key={h.type + "-" + h.id}
              className="px-3 py-2 border-b border-[#161b22]"
            >
              <div className="text-xs text-[#6e7681] mb-1">
                {h.type === "memory"
                  ? "Memory - " + h.kind
                  : (h.role === "user" ? "You - " : "Assistant - ") +
                    (h.conversationTitle ?? "Untitled")}
              </div>
              <p className="text-xs text-[#e6edf3] line-clamp-2">{h.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}