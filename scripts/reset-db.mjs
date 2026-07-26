// KLIGER - Reset Postgres DB (clean slate).
// Usage: node scripts/reset-db.mjs
//
// - קורא את DATABASE_URL מ-.env.local
// - מרוקן את כל הטבלאות (TRUNCATE ... CASCADE)
// - שומר את מבנה הסכימה (schema-postgres.sql לא נדרש מחדש)
// - בפעם הבאה שמישהו ינסה להיכנס, ה-admin ייווצר מחדש מ-ADMIN_EMAIL/ADMIN_INITIAL_PASSWORD

import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

// טען .env.local אם קיים
const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) {
      let val = m[2];
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    }
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[reset-db] DATABASE_URL is not set in .env.local. Aborting.");
  process.exit(1);
}

const sql = neon(url);

const TABLES = [
  "messages",
  "uploads",
  "reminders",
  "email_log",
  "deposits",
  "clients",
  "associations",
  "sessions",
  "users",
];

console.log("[reset-db] Connecting to Neon...");
try {
  await sql`SELECT 1`;
} catch (err) {
  console.error("[reset-db] Cannot connect:", err.message || err);
  process.exit(2);
}

console.log(`[reset-db] Truncating ${TABLES.length} tables...`);
for (const t of TABLES) {
  try {
    await sql.query(`TRUNCATE TABLE ${t} CASCADE`);
    console.log(`  ✓ ${t}`);
  } catch (err) {
    console.warn(
      `  ✗ ${t} — ${err.message || err} (probably doesn't exist yet — that's fine)`
    );
  }
}

console.log("");
console.log("[reset-db] Done. Data cleared, schema kept.");
console.log(
  "[reset-db] Next time you log in, admin will be re-seeded from ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD in .env.local."
);
