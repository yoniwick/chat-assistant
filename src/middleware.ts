import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

const sessionValue = "authorized";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/offline") ||
    pathname.startsWith("/api/auth");
  if (isPublic) return NextResponse.next();

  // No password configured — dev fallback, allow everything.
  if (!process.env.APP_PASSWORD) return NextResponse.next();

  const hasAuth = request.cookies.get(AUTH_COOKIE)?.value === sessionValue;
  if (hasAuth) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|manifest\\.json$|sw\\.js$).*)",
  ],
};
