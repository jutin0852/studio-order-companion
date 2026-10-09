import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  const tables = await pool.query("select table_name from information_schema.tables where table_schema = 'public' order by table_name");
  const users = await pool.query('select count(*)::int as count from "user"');
  console.log(tables.rows.map(({ table_name: tableName }) => tableName).join("\n"));
  console.log(`users=${users.rows[0].count}`);
} finally {
  await pool.end();
}
