import { NextRequest } from "next/server";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        updatedAt: conversations.updatedAt,
        lastMessage: sql<string>`(
          SELECT m.content FROM messages m
          WHERE m.conversation_id = ${conversations.id}
          ORDER BY m.created_at DESC
          LIMIT 1
        )`,
      })
      .from(conversations)
      .where(eq(conversations.archived, false))
      .orderBy(desc(conversations.updatedAt));

    const list = rows.map((r) => ({
      id: r.id,
      title: r.title ?? "New chat",
      updatedAt: r.updatedAt,
      lastMessagePreview: r.lastMessage ?? null,
    }));

    return Response.json({ conversations: list });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let titleBody: { title?: unknown };
    try {
      titleBody = (await req.json()) as { title?: unknown };
    } catch {
      titleBody = {};
    }

    const inserted = await db
      .insert(conversations)
      .values({
        title:
          typeof titleBody.title === "string" && titleBody.title.trim()
            ? titleBody.title.trim()
            : null,
      })
      .returning();

    return Response.json({ conversation: inserted[0] }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}