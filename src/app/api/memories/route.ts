import { listMemories } from "@/lib/memory";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const all = await listMemories();
    return Response.json({
      memories: all.map((m) => ({
        id: m.id,
        kind: m.kind,
        content: m.content,
        importance: m.importance,
        createdAt: m.createdAt,
        lastUsedAt: m.lastUsedAt,
      })),
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}