import { NextRequest } from "next/server";
import { globalSearch } from "@/lib/global-search";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const q = req.nextUrl.searchParams.get("q") ?? "";
    if (!q.trim()) {
      return Response.json({ error: "q is required" }, { status: 400 });
    }
    const hits = await globalSearch(q.trim());
    return Response.json({ results: hits });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}