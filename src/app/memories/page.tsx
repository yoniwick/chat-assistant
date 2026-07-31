"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface MemoryRow {
  id: string;
  kind: string;
  content: string;
  importance: number;
  createdAt: string;
}

const KIND_ORDER = ["fact", "preference", "entity", "task"] as const;
const KIND_LABELS: Record<string, string> = {
  fact: "Facts",
  preference: "Preferences",
  entity: "Entities",
  task: "Tasks",
};

export default function MemoriesPage() {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/memories");
      if (!res.ok) throw new Error("Failed to load memories");
      const data = (await res.json()) as { memories: MemoryRow[] };
      setMemories(data.memories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/memories/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      // ignore
    }
  }, []);

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    rows: memories.filter((m) => m.kind === kind),
  })).filter((g) => g.rows.length > 0);

  const otherKind = memories.filter(
    (m) => !KIND_ORDER.includes(m.kind as (typeof KIND_ORDER)[number]),
  );

  return (
    <main className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Memories</h1>
          <p className="text-sm text-[#8b949e] mt-1">
            What the assistant knows about you. Delete anything inaccurate.
          </p>
        </div>
        <Link
          href="/"
          className="px-3 py-2 rounded-lg text-sm text-[#8b949e] border border-[#30363d] hover:text-white hover:border-[#4f8cff]"
        >
          Back to chat
        </Link>
      </div>

      {loading && <p className="text-sm text-[#6e7681]">Loading</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && grouped.length === 0 && otherKind.length === 0 && (
        <div className="py-16 text-center text-[#6e7681]">
          <p>No memories yet.</p>
          <p className="text-sm mt-2">
            Memories are extracted automatically from your conversations.
          </p>
        </div>
      )}

      {grouped.map((g) => (
        <section key={g.kind} className="mb-8">
          <h2 className="text-sm font-medium text-[#8b949e] uppercase tracking-wide mb-3">
            {KIND_LABELS[g.kind] ?? g.kind} ({g.rows.length})
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6e7681] border-b border-[#1f2937]">
                <th className="py-2 pr-4">Content</th>
                <th className="py-2 pr-4 w-20">Importance</th>
                <th className="py-2 pr-4 w-28">Created</th>
                <th className="py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {g.rows.map((m) => (
                <tr key={m.id} className="border-b border-[#161b22]">
                  <td className="py-2 pr-4">{m.content}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={
                        "inline-flex items-center justify-center w-7 h-6 rounded text-xs font-medium " +
                        (m.importance >= 4
                          ? "bg-red-500/20 text-red-400"
                          : m.importance === 3
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-[#21262d] text-[#8b949e]")
                      }
                    >
                      {m.importance}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-xs text-[#6e7681]">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => void remove(m.id)}
                      className="text-xs text-[#6e7681] hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10"
                      aria-label={"Delete memory: " + m.content}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {otherKind.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-[#8b949e] uppercase tracking-wide mb-3">
            Other ({otherKind.length})
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {otherKind.map((m) => (
                <tr key={m.id} className="border-b border-[#161b22]">
                  <td className="py-2 pr-4">
                    <span className="text-xs text-[#6e7681] mr-2">{m.kind}</span>
                    {m.content}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => void remove(m.id)}
                      className="text-xs text-[#6e7681] hover:text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
