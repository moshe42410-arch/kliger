// =============================================================================
// KLIGER - Migrate local SQLite data → Neon Postgres
// =============================================================================
// Run this ONCE, LOCALLY, before your first Vercel deployment.
//
// Prerequisites:
//   1. Neon database created and schema loaded (via scripts/schema-postgres.sql)
//   2. NEON_URL env var set to your Neon connection string
//      (get it from Neon Dashboard → Connection Details → "connection string")
//   3. Local data/kliger.db exists with data you want to migrate
//
// Usage (PowerShell):
//   $env:NEON_URL="postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
//   node scripts/migrate-sqlite-to-pg.mjs
//
// Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.

import { DatabaseSync } from "node:sqlite";
import { neon } from "@neondatabase/serverless";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = path.join(process.cwd(), "data", "kliger.db");
const NEON_URL = process.env.NEON_URL;

if (!NEON_URL) {
  console.error("❌ NEON_URL environment variable is required.");
  console.error("   Set it to your Neon connection string:");
  console.error(
    '   $env:NEON_URL="postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"'
  );
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ SQLite DB not found at ${DB_PATH}`);
  console.error("   Nothing to migrate. Run the app first to create it.");
  process.exit(1);
}

const sqlite = new DatabaseSync(DB_PATH, { readOnly: true });
const sql = neon(NEON_URL);

const TABLES = [
  {
    name: "users",
    cols: [
      "id",
      "email",
      "name",
      "password_hash",
      "must_change_password",
      "role",
      "active",
      "phone",
      "company_name",
      "logo_filename",
      "dashboard_cards",
      "gmail_email",
      "gmail_refresh_token",
      "gmail_access_token",
      "gmail_token_expiry",
      "gmail_connected_at",
      "email_templates",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "sessions",
    cols: ["id", "user_id", "expires_at", "created_at"],
  },
  {
    name: "clients",
    cols: [
      "id",
      "owner_id",
      "name",
      "emails",
      "phones",
      "reminder_channel",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "associations",
    cols: [
      "id",
      "owner_id",
      "name",
      "email",
      "bank_number",
      "branch_number",
      "account_number",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "deposits",
    cols: [
      "id",
      "owner_id",
      "client_id",
      "association_id",
      "deposit_type",
      "responsibility",
      "amount",
      "day_of_month",
      "days_before_reminder",
      "start_date",
      "end_date",
      "reminder_recipient",
      "active",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "reminders",
    cols: [
      "id",
      "owner_id",
      "deposit_id",
      "client_id",
      "status",
      "phase",
      "escalated_to_client",
      "target_date",
      "scheduled_for",
      "last_sent_at",
      "sends_count",
      "client_response",
      "client_response_at",
      "paid_at",
      "subject",
      "body",
      "upload_token",
      "snooze_until",
      "client_remind_at",
      "month_bucket",
      "carried_over",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "uploads",
    cols: [
      "id",
      "owner_id",
      "reminder_id",
      "filename",
      "original_name",
      "mime_type",
      "size",
      "uploaded_at",
    ],
  },
  {
    name: "messages",
    cols: [
      "id",
      "owner_id",
      "reminder_id",
      "direction",
      "subject",
      "body",
      "email_status",
      "email_error",
      "metadata",
      "created_at",
    ],
  },
  {
    name: "email_log",
    cols: [
      "id",
      "owner_id",
      "reminder_id",
      "client_id",
      "to_addresses",
      "subject",
      "body",
      "status",
      "error",
      "sent_at",
    ],
  },
];

async function migrateTable({ name, cols }) {
  let rows;
  try {
    rows = sqlite.prepare(`SELECT ${cols.join(", ")} FROM ${name}`).all();
  } catch (err) {
    console.warn(
      `⚠️  Skipping ${name}: ${err instanceof Error ? err.message : err}`
    );
    return;
  }

  if (rows.length === 0) {
    console.log(`   ${name}: (empty)`);
    return;
  }

  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const insertSql = `INSERT INTO ${name} (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;

  let inserted = 0;
  for (const row of rows) {
    const values = cols.map((c) => row[c] ?? null);
    try {
      await sql(insertSql, values);
      inserted++;
    } catch (err) {
      console.error(
        `   ❌ Row error in ${name} (id=${row.id}):`,
        err instanceof Error ? err.message : err
      );
    }
  }
  console.log(`   ${name}: migrated ${inserted}/${rows.length}`);
}

async function main() {
  console.log("🚀 KLIGER: SQLite → Neon Postgres migration\n");

  // Sanity check: can we connect to Neon?
  try {
    const [{ ok }] = await sql`SELECT 1 AS ok`;
    if (ok !== 1) throw new Error("unexpected response");
  } catch (err) {
    console.error(
      "❌ Failed to connect to Neon:",
      err instanceof Error ? err.message : err
    );
    console.error("   Check that NEON_URL is correct and the schema is loaded.");
    process.exit(1);
  }
  console.log("✅ Connected to Neon.\n");

  console.log("📦 Migrating tables:");
  for (const table of TABLES) {
    await migrateTable(table);
  }

  console.log("\n🎉 Done!");
  console.log(
    "Next: deploy to Vercel — the app will read from Neon automatically."
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
