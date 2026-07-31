import { NextRequest } from "next/server";
import { runChat } from "@/lib/chat";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatBody {
  conversationId?: unknown;
  message?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: ChatBody;
    try {
      body = (await req.json()) as ChatBody;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body.message !== "string" || body.message.trim().length === 0) {
      return Response.json({ error: "message is required" }, { status: 400 });
    }
    if (typeof body.conversationId !== "string") {
      return Response.json(
        { error: "conversationId is required" },
        { status: 400 },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown, event?: string) => {
          let data = JSON.stringify(obj);
          if (event) data = "event: " + event + "\ndata: " + data + "\n\n";
          else data = "data: " + data + "\n\n";
          controller.enqueue(encoder.encode(data));
        };

        try {
          await runChat({
            conversationId: body.conversationId as string,
            message: body.message as string,
            onDelta: (delta) => send({ delta }),
          });
          send({ done: true });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Internal server error";
          send({ error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}