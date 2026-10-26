import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

type QueryResult = { rows: unknown[]; rowCount: number };

// Better Auth owns the "user" table in production; migrations only reference it.
const USER_TABLE = `
  CREATE TABLE "user" (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    "emailVerified" boolean NOT NULL DEFAULT false,
    image text,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "updatedAt" timestamptz NOT NULL DEFAULT now()
  );`;

/**
 * An in-memory Postgres with every migration applied, wrapped in the small part
 * of the `pg` Pool API that the app uses (query and connect), so route handlers
 * run their real SQL in tests.
 */
export async function createTestPool() {
  const pglite = new PGlite();
  await pglite.exec(USER_TABLE);
  const migrations = path.join(process.cwd(), "db", "migrations");
  for (const file of (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort()) {
    // gen_random_uuid() is built into modern Postgres, and PGlite does not ship pgcrypto.
    const sql = (await readFile(path.join(migrations, file), "utf8")).replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, "");
    await pglite.exec(sql);
  }

  const query = async (text: string, params?: unknown[]): Promise<QueryResult> => {
    const result = await pglite.query(text, params);
    return { rows: result.rows, rowCount: result.affectedRows || result.rows.length };
  };
  const pool = {
    query,
    // One connection is enough: tests run their requests one at a time.
    connect: async () => ({ query, release: () => undefined }),
    end: async () => pglite.close(),
  };
  return pool;
}
