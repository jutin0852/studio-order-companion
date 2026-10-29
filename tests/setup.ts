import { vi } from "vitest";
import { createTestPool } from "./helpers/db";

process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.CLOUDINARY_CLOUD_NAME = "demo";
// Notifications ship paused; the notification tests run with them switched on.
process.env.STUDIO_NOTIFICATIONS_PAUSED = "false";

const state = vi.hoisted(() => ({ pool: null as unknown }));

// db.ts builds its pool from `pg` when first imported; hand it the in-memory one.
vi.mock("pg", () => {
  class Pool {
    constructor() {
      return state.pool as object;
    }
  }
  return { Pool, default: { Pool } };
});

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
  isAuthConfigured: true,
}));

state.pool = await createTestPool();
