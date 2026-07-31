import {
  retrieveMemories,
  searchOtherConversations,
  type CrossConversationMessage,
  type RankedMemory,
} from "./memory";
import { countTokens } from "./tokens";

export interface ContextBundle {
  systemPrompt: string;
  memories: RankedMemory[];
  recall: CrossConversationMessage[];
  summary: string | null;
  recentTurns: Array<{ role: string; content: string; createdAt: Date }>;
}

export const MAX_CONTEXT_TOKENS = 8000;

export async function buildContext(opts: {
  userMessage: string;
  conversationId: string;
  summary: string | null;
  messageCount: number;
  recentTurns: Array<{ role: string; content: string; createdAt: Date }>;
}): Promise<ContextBundle> {
  const [memories, recall] = await Promise.all([
    retrieveMemories(opts.userMessage, 15),
    searchOtherConversations(opts.userMessage, opts.conversationId, 6),
  ]);

  const systemPrompt = buildSystemPrompt();
  const bundle: ContextBundle = {
    systemPrompt,
    memories,
    recall,
    summary: opts.messageCount > 10 ? opts.summary : null,
    recentTurns: opts.recentTurns,
  };
  return trimContext(bundle);
}

function buildSystemPrompt(): string {
  const now = new Date().toISOString();
  return (
    "You are a personal AI assistant. You are fast, terse, and direct. " +
    "Default to short answers (1-4 sentences). Only go long when the user " +
    "explicitly asks for depth.\n\n" +
    "Current date/time: " +
    now
  );
}

/**
 * Ensures the assembled context stays under the token cap.
 * Never drops section 5 (recent turns). Drops section 3 first, then 2.
 */
function trimContext(bundle: ContextBundle): ContextBundle {
  let budget = MAX_CONTEXT_TOKENS - countTokens(bundle.systemPrompt);
  // Section 5 always stays
  budget -= countTokens(
    bundle.recentTurns.map((t) => t.content).join("\n"),
  );

  // Section 2: memories
  let memoryBudget = budget;
  const keptMemories: RankedMemory[] = [];
  for (const m of bundle.memories) {
    const cost = countTokens(m.content) + 10;
    if (memoryBudget >= cost) {
      keptMemories.push(m);
      memoryBudget -= cost;
    } else break;
  }

  // Section 3: recall (dropped first)
  let recallBudget = memoryBudget;
  const keptRecall: CrossConversationMessage[] = [];
  for (const r of bundle.recall) {
    const cost = countTokens(r.content) + 20;
    if (recallBudget >= cost) {
      keptRecall.push(r);
      recallBudget -= cost;
    } else break;
  }

  return {
    ...bundle,
    memories: keptMemories,
    recall: keptRecall,
  };
}

/** Render context as system turns the model sees, in order. */
export function renderContext(
  bundle: ContextBundle,
): Array<{ role: "system" | "user"; content: string }> {
  const turns: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: bundle.systemPrompt },
  ];

  if (bundle.memories.length > 0) {
    const bullets = bundle.memories
      .map((m) => "- [" + m.kind + " " + m.importance + "/5] " + m.content)
      .join("\n");
    turns.push({
      role: "system",
      content: "## What I know about the user\n" + bullets,
    });
  }

  if (bundle.recall.length > 0) {
    const lines = bundle.recall.map((r) => {
      const title = r.conversationTitle ?? "Untitled";
      const date = r.createdAt.toLocaleDateString();
      return "- (" + title + ", " + date + ") " + r.role + ": " + r.content;
    });
    turns.push({
      role: "system",
      content:
        "## Relevant excerpts from past conversations\n" + lines.join("\n"),
    });
  }

  if (bundle.summary) {
    turns.push({
      role: "system",
      content: "## Conversation summary\n" + bundle.summary,
    });
  }

  return turns;
}
