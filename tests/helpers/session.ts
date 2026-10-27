import { vi } from "vitest";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type TestUser = { id: string; name: string; email: string };

export const alice: TestUser = { id: "user-alice", name: "Alice", email: "alice@example.test" };
export const bob: TestUser = { id: "user-bob", name: "Bob", email: "bob@example.test" };

/** Makes the next requests come from this user (or from nobody when null). */
export async function signInAs(user: TestUser | null) {
  if (user) {
    await db!.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [user.id, user.name, user.email],
    );
  }
  vi.mocked(auth.api.getSession).mockResolvedValue((user ? { user, session: { id: `session-${user.id}` } } : null) as never);
}

export function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const routeParams = (id: string) => ({ params: Promise.resolve({ id }) });

export async function readJson<T = Record<string, unknown>>(response: Response) {
  return (await response.json()) as T;
}
