import { cookies } from "next/headers";

export const AUTH_COOKIE = "chat_assistant_auth";
const SESSION_VALUE = "authorized";

/**
 * Server-side auth check. Reads the httpOnly cookie set by /api/auth.
 * Returns true when APP_PASSWORD is not set (dev fallback so the app can
 * run before the user adds a password).
 */
export async function isAuthenticated(): Promise<boolean> {
  if (!process.env.APP_PASSWORD) return true;
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value === SESSION_VALUE;
}

export function sessionValue(): string {
  return SESSION_VALUE;
}