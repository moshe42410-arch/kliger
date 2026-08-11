/**
 * Reset admin password in Neon to match ADMIN_INITIAL_PASSWORD from .env.local
 * Usage: node scripts/reset-admin-password.mjs
 */
import { neon } from "@neondatabase/serverless";
import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Prefer .env.local over any leftover system env (e.g. other projects).
    process.env[m[1]] = val;
  }
}

const url = process.env.DATABASE_URL;
const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_INITIAL_PASSWORD || "";

if (!url) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}
if (!email) {
  console.error("Missing ADMIN_EMAIL in .env.local");
  process.exit(1);
}
if (!password || password.length < 4) {
  console.error("Missing/too-short ADMIN_INITIAL_PASSWORD in .env.local");
  process.exit(1);
}

function hashPassword(plain) {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const sql = neon(url);
const hash = hashPassword(password);
const now = new Date().toISOString();

const updated = await sql`
  UPDATE users
  SET password_hash = ${hash},
      must_change_password = 0,
      updated_at = ${now}
  WHERE lower(email) = ${email}
  RETURNING id, email, role
`;

if (!updated[0]) {
  console.error(`No user found with email: ${email}`);
  process.exit(2);
}

await sql`DELETE FROM sessions WHERE user_id = ${updated[0].id}`;

console.log("OK — password reset for:", updated[0].email, `(${updated[0].role})`);
console.log("You can now log in with that email + ADMIN_INITIAL_PASSWORD.");
