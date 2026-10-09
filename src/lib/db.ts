import { Pool, type PoolClient } from "pg";

const databaseUrl = process.env.DATABASE_URL;

export const db = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: 5,
      ssl: databaseUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
    })
  : null;

function requireDatabase() {
  if (!db) throw new Error("DATABASE_URL is not configured.");
  return db;
}

export async function ensureUserWorkspace(userId: string, userName?: string | null) {
  const client = await requireDatabase().connect();
  try {
    await client.query("BEGIN");
    const business = await client.query<{ id: string }>(
      `INSERT INTO businesses (owner_user_id, name)
       VALUES ($1, $2)
       ON CONFLICT (owner_user_id) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [userId, userName?.trim() ? `${userName.trim()}'s business` : "My business"],
    );
    const businessId = business.rows[0]?.id;
    if (!businessId) throw new Error("Could not create the user's business.");

    await client.query("INSERT INTO business_settings (business_id) VALUES ($1) ON CONFLICT (business_id) DO NOTHING", [businessId]);
    await client.query("INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [userId]);
    await client.query("COMMIT");
    return businessId;
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function rollback(client: PoolClient) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original database error.
  }
}
