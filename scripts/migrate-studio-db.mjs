import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to migrate Studio.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  ssl: databaseUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

const migrationsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const migrationFiles = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();

try {
  for (const migrationFile of migrationFiles) {
    const migration = await readFile(path.join(migrationsDirectory, migrationFile), "utf8");
    await pool.query(migration);
    console.log(`Applied ${migrationFile}.`);
  }
  console.log("Studio database schema is up to date.");
} finally {
  await pool.end();
}
