import { NextRequest } from "next/server";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await isAuthenticated())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;

    const convo = await db.query.conversations.findFirst({
      where: eq(conversations.id, id),
    });
    if (!convo || convo.archived) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));

    return Response.json({
      conversation: convo,
      messages: history.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        searchUsed: m.searchUsed,
        sources: m.sources ?? [],
      })),
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await isAuthenticated())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;

    const updated = await db
      .update(conversations)
      .set({ archived: true })
      .where(eq(conversations.id, id))
      .returning({ id: conversations.id });

    if (updated.length === 0) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}