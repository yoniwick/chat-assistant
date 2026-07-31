import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, sessionValue } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AuthBody {
  password?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const expected = process.env.APP_PASSWORD;
    if (!expected) {
      // No password configured — allow access (dev fallback).
      const res = NextResponse.json({ ok: true });
      res.cookies.set(AUTH_COOKIE, sessionValue(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    let body: AuthBody;
    try {
      body = (await req.json()) as AuthBody;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (body.password === expected) {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(AUTH_COOKIE, sessionValue(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    return Response.json({ error: "Invalid password" }, { status: 401 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}