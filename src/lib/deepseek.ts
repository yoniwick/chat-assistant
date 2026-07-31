import OpenAI from "openai";

const baseURL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

export const DEEPSEEK_MODEL = model;

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");
    _client = new OpenAI({ apiKey, baseURL });
  }
  return _client;
}

export interface ChatTurn {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; name: string; arguments: string }>;
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface CompletionResult {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string | null;
}

export const WEB_SEARCH_TOOL: ToolDef = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current events, prices, docs, versions, or any fact that may have changed recently. Do not call for general knowledge, coding help, or personal history.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Concise search query, 2-6 words",
        },
      },
      required: ["query"],
    },
  },
};

/**
 * One retry with exponential backoff on 429 and 5xx.
 * Returns null on failure so callers can degrade gracefully.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 429 && !(status !== undefined && status >= 500)) {
      throw err;
    }
    await new Promise((r) => setTimeout(r, 1000));
    try {
      return await fn();
    } catch (err2) {
      const s2 = (err2 as { status?: number }).status;
      if (s2 !== 429 && !(s2 !== undefined && s2 >= 500)) throw err2;
      return null;
    }
  }
}

function toApiMessages(
  turns: ChatTurn[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return turns.map((t) => {
    if (t.role === "tool") {
      return {
        role: "tool",
        content: t.content,
        tool_call_id: t.tool_call_id ?? "",
      } satisfies OpenAI.Chat.Completions.ChatCompletionMessageParam;
    }
    if (t.role === "assistant" && t.tool_calls && t.tool_calls.length > 0) {
      return {
        role: "assistant",
        content: t.content,
        tool_calls: t.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      } satisfies OpenAI.Chat.Completions.ChatCompletionMessageParam;
    }
    return {
      role: t.role,
      content: t.content,
    } satisfies OpenAI.Chat.Completions.ChatCompletionMessageParam;
  });
}

/**
 * Non-streaming completion. Used for tool call loops and background
 * memory extraction. Returns null on unresolvable transient errors.
 */
export async function complete(
  messages: ChatTurn[],
  opts: { tools?: ToolDef[]; maxTokens?: number; temperature?: number } = {},
): Promise<CompletionResult | null> {
  const res = await withRetry(() =>
    getClient().chat.completions.create({
      model,
      messages: toApiMessages(messages),
      ...(opts.tools && opts.tools.length > 0
        ? { tools: opts.tools as OpenAI.Chat.Completions.ChatCompletionTool[] }
        : {}),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      temperature: opts.temperature ?? 0.7,
      stream: false,
    }),
  );
  if (!res) return null;
  const choice = res.choices[0];
  const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).flatMap(
    (tc) => {
      if ("function" in tc) {
        return [
          {
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        ];
      }
      return [];
    },
  );
  return {
    content: choice.message.content,
    toolCalls,
    finishReason: choice.finish_reason ?? null,
  };
}

export interface StreamResult {
  text: string;
  toolCalls: ToolCall[];
}

export interface StreamOptions {
  tools?: ToolDef[];
  temperature?: number;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}

export async function streamComplete(
  messages: ChatTurn[],
  opts: StreamOptions,
): Promise<StreamResult | null> {
  const stream = await withRetry(() =>
    getClient().chat.completions.create({
      model,
      messages: toApiMessages(messages),
      ...(opts.tools && opts.tools.length > 0
        ? { tools: opts.tools as OpenAI.Chat.Completions.ChatCompletionTool[] }
        : {}),
      temperature: opts.temperature ?? 0.7,
      stream: true,
    }),
  );
  if (!stream) return null;

  let text = "";
  const toolCalls: ToolCall[] = [];
  const toolCallDrafts: {
    id?: string;
    name?: string;
    args?: string;
  }[] = [];

  for await (const chunk of stream) {
    if (opts.signal?.aborted) break;
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;
    if (delta.content) {
      text += delta.content;
      opts.onDelta(delta.content);
    }
    // Tool call deltas arrive incrementally; accumulate.
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        const draft = (toolCallDrafts[idx] ??= {});
        if (tc.id) draft.id = (draft.id ?? "") + tc.id;
        if (tc.function?.name) draft.name = (draft.name ?? "") + tc.function.name;
        if (tc.function?.arguments)
          draft.args = (draft.args ?? "") + tc.function.arguments;
      }
    }
  }

  for (const d of toolCallDrafts) {
    if (d.id && d.name && d.args !== undefined) {
      toolCalls.push({ id: d.id, name: d.name, arguments: d.args });
    }
  }

  return { text, toolCalls };
}