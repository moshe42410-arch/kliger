import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

const envFile = path.join(process.cwd(), ".env.local");
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
  process.env[m[1]] = val;
}

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  SELECT email, gmail_email,
         (gmail_refresh_token IS NOT NULL) AS has_token,
         gmail_connected_at
  FROM users
  WHERE lower(email) = lower('moshe42410@gmail.com')
`;
console.log(JSON.stringify(rows, null, 2));
