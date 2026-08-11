import fs from "fs";
import { Pool } from "@neondatabase/serverless";

const env = fs.readFileSync(".env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}
const url = m[1].trim().replace(/^["']|["']$/g, "");
const pool = new Pool({ connectionString: url });
const raw = fs.readFileSync("scripts/migrate-client-crm.sql", "utf8");
const stmts = raw
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .trim()
  )
  .filter(Boolean);

for (const stmt of stmts) {
  try {
    await pool.query(stmt);
    console.log("OK:", stmt.slice(0, 80).replace(/\s+/g, " "));
  } catch (e) {
    console.error("FAIL:", e.message, stmt.slice(0, 80));
  }
}
await pool.end();
console.log("migration finished");
