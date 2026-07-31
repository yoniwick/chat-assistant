import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy singleton: the Neon HTTP driver must not be instantiated at module
// load time (that throws when DATABASE_URL is unset, e.g. during `next build`
// page-data collection). Construct it on first use inside a request.
let _db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}

// Proxy that forwards every property access to the lazily-created drizzle
// instance. Consumers keep using `db.insert(...)`, `db.query.conversations`
// etc. without triggering neon() at import time (which breaks `next build`
// page-data collection when DATABASE_URL is unset).
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    const real = getDb();
    const value = (real as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(real);
    }
    return value;
  },
});