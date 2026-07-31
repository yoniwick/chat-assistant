import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { type ChatTurn, WEB_SEARCH_TOOL, streamComplete, complete } from "./deepseek";
import { webSearch, type SearchResult } from "./tavily";
import { buildContext, renderContext, type ContextBundle } from "./context";
import { extractMemories, summarizeConversation } from "./memory";
import type { Source } from "@/db/schema";

export interface ChatResult {
  content: string | null;
  searchUsed: boolean;
  sources: Source[];
  context: ContextBundle;
}

export interface ChatRequest {
  conversationId: string;
  message: string;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
}

export async function loadConversation(id: string) {
  const found = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.archived, false)),
  });
  return found ?? null;
}

export async function loadRecentMessages(conversationId: string, limit = 12) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(limit);
}

function safeParseQuery(args: string): string {
  try {
    const parsed = JSON.parse(args) as { query?: unknown };
    if (typeof parsed.query === "string" && parsed.query.trim()) {
      return parsed.query.trim();
    }
  } catch {
    // fall through
  }
  return "latest news";
}

function formatToolResult(search: {
  answer?: string;
  results: SearchResult[];
}): string {
  const parts: string[] = [];
  if (search.answer) parts.push("Answer: " + search.answer);
  if (search.results.length > 0) {
    const lines = search.results.map((r, i) => {
      return (i + 1) + ". " + r.title + " - " + r.url + "\n   " + r.snippet;
    });
    parts.push("Search results:\n" + lines.join("\n"));
  }
  return parts.length > 0 ? parts.join("\n\n") : "No results found.";
}

function searchRound(
  turns: ChatTurn[],
  call: { id: string; name: string; arguments: string },
  search: { answer?: string; results: SearchResult[] },
): ChatTurn[] {
  return [
    ...turns,
    {
      role: "assistant",
      content: "",
      tool_calls: [
        { id: call.id, name: call.name, arguments: call.arguments },
      ],
    },
    {
      role: "tool",
      content: formatToolResult(search),
      tool_call_id: call.id,
    },
  ];
}

export async function runChat(req: ChatRequest): Promise<ChatResult> {
  const convo = await loadConversation(req.conversationId);
  if (!convo) throw new Error("Conversation not found");

  const recent = await loadRecentMessages(req.conversationId, 12);

  const bundle = await buildContext({
    userMessage: req.message,
    conversationId: req.conversationId,
    summary: convo.summary,
    messageCount: recent.length,
    recentTurns: recent.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });

  const contextTurns = renderContext(bundle);
  const conversationTurns: ChatTurn[] = recent
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const baseTurns: ChatTurn[] = [
    ...contextTurns.map((t) => ({
      role: t.role as "system" | "user",
      content: t.content,
    })),
    ...conversationTurns,
    { role: "user" as const, content: req.message },
  ];

  let searchUsed = false;
  let sources: Source[] = [];
  let finalText = "";

  const firstCall = await complete(baseTurns, {
    tools: [WEB_SEARCH_TOOL],
    temperature: 0.4,
  });
  if (!firstCall) throw new Error("DeepSeek request failed");

  let finalTurns = baseTurns;

  if (
    firstCall.toolCalls.length > 0 &&
    firstCall.toolCalls[0].name === "web_search"
  ) {
    searchUsed = true;
    const call = firstCall.toolCalls[0];
    const search = await webSearch(safeParseQuery(call.arguments));
    sources = search.results;

    finalTurns = searchRound(baseTurns, call, search);

    const secondCall = await complete(finalTurns, {
      tools: [WEB_SEARCH_TOOL],
      temperature: 0.4,
    });
    if (!secondCall) throw new Error("DeepSeek request failed");

    if (
      secondCall.toolCalls.length > 0 &&
      secondCall.toolCalls[0].name === "web_search"
    ) {
      // Round 2 - final search, then force the answer.
      const call2 = secondCall.toolCalls[0];
      const search2 = await webSearch(safeParseQuery(call2.arguments));
      sources = [...sources, ...search2.results].slice(0, 5);
      finalTurns = searchRound(finalTurns, call2, search2);
    }
  }

  const streamed = await streamComplete(finalTurns, {
    ...(searchUsed ? {} : { tools: [WEB_SEARCH_TOOL] }),
    temperature: 0.4,
    onDelta: (d) => {
      finalText += d;
      req.onDelta(d);
    },
    signal: req.signal,
  });
  if (!streamed) throw new Error("DeepSeek streaming failed");

  await persistMessages(req, finalText, searchUsed, sources);

  // Non-blocking background work: memory extraction + summary.
  void (async () => {
    try {
      if (finalText.trim()) {
        await extractMemories(req.message, finalText, req.conversationId);
      }
      const all = await loadRecentMessages(req.conversationId, 200);
      if (all.length > 0 && all.length % 10 === 0) {
        const summary = await summarizeConversation(
          convo.title,
          all.map((m) => ({ role: m.role, content: m.content })),
        );
        if (summary) {
          await db
            .update(conversations)
            .set({ summary, updatedAt: new Date() })
            .where(eq(conversations.id, req.conversationId));
        }
      }
    } catch {
      // Background failures must never break the streamed reply.
    }
  })();

  return { content: finalText, searchUsed, sources, context: bundle };
}

async function persistMessages(
  req: ChatRequest,
  assistantText: string,
  searchUsed: boolean,
  sources: Source[],
): Promise<void> {
  await db.insert(messages).values({
    conversationId: req.conversationId,
    role: "user",
    content: req.message,
  });
  await db.insert(messages).values({
    conversationId: req.conversationId,
    role: "assistant",
    content: assistantText,
    searchUsed,
    sources: sources.length > 0 ? sources : null,
  });
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, req.conversationId));

  // Auto-title from the first user message.
  const count = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.conversationId, req.conversationId));
  if (count.length <= 2) {
    const title =
      req.message.slice(0, 60) + (req.message.length > 60 ? "..." : "");
    await db
      .update(conversations)
      .set({ title })
      .where(eq(conversations.id, req.conversationId));
  }
}