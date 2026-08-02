import { neon } from "@neondatabase/serverless";

export interface GlobalSearchHit {
  type: "message" | "memory";
  id: string;
  content: string;
  conversationId: string | null;
  conversationTitle: string | null;
  role: string | null;
  kind: string | null;
  createdAt: string;
  rank: number;
}

/** Search across all messages and memories via Postgres full-text search. */
export async function globalSearch(
  q: string,
  limit = 20,
): Promise<GlobalSearchHit[]> {
  const raw = neon(process.env.DATABASE_URL!);
  const rows = (await raw`
    SELECT * FROM (
      SELECT m.id, m.content, m.conversation_id AS conversation_id,
             c.title AS conversation_title, m.role,
             NULL AS kind, m.created_at,
             ts_rank(m.tsv, plainto_tsquery('english', ${q})) AS rank
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.tsv @@ plainto_tsquery('english', ${q})
        AND c.archived = false
      UNION ALL
      SELECT mem.id, mem.content, NULL AS conversation_id,
             NULL AS conversation_title, NULL AS role,
             mem.kind, mem.created_at,
             ts_rank(mem.tsv, plainto_tsquery('english', ${q})) AS rank
      FROM memories mem
      WHERE mem.tsv @@ plainto_tsquery('english', ${q})
    ) hits
    ORDER BY rank DESC, created_at DESC
    LIMIT ${limit}
  `) as Array<{
    id: string;
    content: string;
    conversation_id: string | null;
    conversation_title: string | null;
    role: string | null;
    kind: string | null;
    created_at: string;
    rank: number;
  }>;

  return rows.map((r) => ({
    type: r.kind !== null ? "memory" : "message",
    id: r.id,
    content: r.content,
    conversationId: r.conversation_id,
    conversationTitle: r.conversation_title,
    role: r.role,
    kind: r.kind,
    createdAt: r.created_at,
    rank: r.rank,
  }));
}