import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { memories } from "@/db/schema";
import { complete } from "./deepseek";
import type { Memory } from "@/db/schema";

export interface RankedMemory {
  id: string;
  kind: string;
  content: string;
  importance: number;
  createdAt: Date;
}

export async function retrieveMemories(
  query: string,
  limit = 15,
): Promise<RankedMemory[]> {
  const raw = neon(process.env.DATABASE_URL!);
  const rows = (await raw`
    SELECT id, kind, content, importance, created_at
    FROM memories
    WHERE tsv @@ plainto_tsquery('english', ${query})
    ORDER BY ts_rank(tsv, plainto_tsquery('english', ${query})) DESC,
             importance DESC, created_at DESC
    LIMIT ${limit}
  `) as Array<{
    id: string;
    kind: string;
    content: string;
    importance: number;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    content: r.content,
    importance: r.importance,
    createdAt: new Date(r.created_at),
  }));
}

export interface CrossConversationMessage {
  id: string;
  content: string;
  role: string;
  conversationId: string;
  conversationTitle: string | null;
  createdAt: Date;
}

export interface ExtractedMemory {
  kind: "fact" | "preference" | "entity" | "task";
  content: string;
  importance: number;
}

const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction engine. Given a user/assistant exchange, extract durable facts about the user worth remembering across conversations: preferences, personal facts, named entities, and long-term tasks.

Rules:
- If the exchange is trivial ("thanks", "ok", greetings, small talk with no real information), return {"memories": []}.
- Each memory must be ONE atomic statement in third person, e.g. "Prefers PowerShell-safe commands".
- kind is one of: fact, preference, entity, task.
- importance is 1-5 (5 = must never forget, 1 = marginal).
- Do NOT extract facts about the assistant, general knowledge, or ephemeral chat details.
- Respond with STRICT JSON only. No markdown fences, no preamble, no trailing text.
- Format: {"memories": [{"kind": "...", "content": "...", "importance": 1-5}]}`;

/**
 * Non-blocking memory extraction. Call after each assistant reply
 * without awaiting (fire-and-forget with .catch()).
 */
export async function extractMemories(
  userMessage: string,
  assistantReply: string,
  conversationId: string | null,
): Promise<ExtractedMemory[]> {
  const result = await complete(
    [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `User: ${userMessage}\n\nAssistant: ${assistantReply}`,
      },
    ],
    { temperature: 0 },
  );
  if (!result || !result.content) return [];

  const parsed = parseExtractionJson(result.content);
  if (!parsed) return [];

  const raw = neon(process.env.DATABASE_URL!);
  const inserted: ExtractedMemory[] = [];

  for (const m of parsed.memories) {
    if (!m.content || m.content.trim().length === 0) continue;
    if (!isValidKind(m.kind)) continue;
    const importance = clampImportance(m.importance);
    const content = m.content.trim();

    const similar = (await raw`
      SELECT id FROM memories
      WHERE similarity(content, ${content}) > 0.8
      LIMIT 1
    `) as Array<{ id: string }>;
    if (similar.length > 0) continue;

    await getDb()
      .insert(memories)
      .values({
      content,
      kind: m.kind,
      importance,
      conversationId,
    });
    inserted.push({ kind: m.kind, content, importance });
  }

  return inserted;
}

/**
 * Summarize a conversation. Called on every 10th message. Kept under
 * 200 words by the model prompt.
 */
export async function summarizeConversation(
  conversationTitle: string | null,
  messages: Array<{ role: string; content: string }>,
): Promise<string | null> {
  const transcript = messages
    .filter((m) => m.role !== "tool" && m.role !== "system")
    .slice(-80)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const result = await complete(
    [
      { role: "system", content: "Write a concise summary under 200 words. Third person, paragraph form, no preamble." },
      {
        role: "user",
        content: `Conversation: ${conversationTitle ?? "Untitled"}\n\n${transcript}`,
      },
    ],
    { temperature: 0.3, maxTokens: 250 },
  );
  return result?.content?.trim() ?? null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseExtractionJson(text: string): {
  memories: Array<{ kind: string; content: string; importance: number }>;
} | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "memories" in parsed &&
      Array.isArray((parsed as { memories: unknown[] }).memories)
    ) {
      return parsed as {
        memories: Array<{ kind: string; content: string; importance: number }>;
      };
    }
    return null;
  } catch {
    return null;
  }
}

function isValidKind(kind: string): kind is ExtractedMemory["kind"] {
  return kind === "fact" || kind === "preference" || kind === "entity" || kind === "task";
}

function clampImportance(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export async function listMemories(): Promise<Memory[]> {
  return getDb().select().from(memories).orderBy(memories.createdAt);
}

export async function deleteMemory(id: string): Promise<void> {
  await getDb().delete(memories).where(sql`${memories.id} = ${id}`);
}

export async function touchMemory(id: string): Promise<void> {
  await getDb()
    .update(memories)
    .set({ lastUsedAt: new Date() })
    .where(sql`${memories.id} = ${id}`);
}

export async function searchOtherConversations(
  query: string,
  excludeConversationId: string,
  limit = 6,
): Promise<CrossConversationMessage[]> {
  const raw = neon(process.env.DATABASE_URL!);
  const rows = (await raw`
    SELECT m.id, m.content, m.role, m.conversation_id,
           c.title AS conversation_title, m.created_at
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.tsv @@ plainto_tsquery('english', ${query})
      AND m.conversation_id <> ${excludeConversationId}
      AND c.archived = false
      AND m.role IN ('user', 'assistant')
    ORDER BY ts_rank(m.tsv, plainto_tsquery('english', ${query})) DESC,
             m.created_at DESC
    LIMIT ${limit}
  `) as Array<{
    id: string;
    content: string;
    role: string;
    conversation_id: string;
    conversation_title: string | null;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    role: r.role,
    conversationId: r.conversation_id,
    conversationTitle: r.conversation_title,
    createdAt: new Date(r.created_at),
  }));
}