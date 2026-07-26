/**
 * Deep email diagnostics for KLIGER (local .env.local + Neon).
 */
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

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

function mask(s) {
  if (!s) return "(empty)";
  if (s.length <= 8) return "****";
  return s.slice(0, 6) + "..." + s.slice(-4);
}

const report = [];
function log(title, data) {
  report.push({ title, data });
  console.log("\n=== " + title + " ===");
  console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

log("ENV KEYS PRESENT", {
  DATABASE_URL: Boolean(process.env.DATABASE_URL?.startsWith("postgres")),
  DATABASE_URL_prefix: process.env.DATABASE_URL?.slice(0, 20),
  APP_URL: process.env.APP_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: mask(process.env.GOOGLE_CLIENT_SECRET),
  GOOGLE_CLIENT_SECRET_ends: process.env.GOOGLE_CLIENT_SECRET?.slice(-4),
  SMTP_HOST: process.env.SMTP_HOST || "(none)",
  SMTP_USER: process.env.SMTP_USER || "(none)",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD ? mask(process.env.SMTP_PASSWORD) : "(none)",
  ALLOW_SMTP_FALLBACK: process.env.ALLOW_SMTP_FALLBACK || "(unset)",
});

const sql = neon(process.env.DATABASE_URL);
const users = await sql`
  SELECT id, email, role, active,
         gmail_email,
         (gmail_refresh_token IS NOT NULL) AS has_refresh,
         length(gmail_refresh_token) AS refresh_len,
         gmail_connected_at,
         left(gmail_refresh_token, 8) AS refresh_prefix
  FROM users
  ORDER BY role DESC, created_at ASC
`;
log("USERS IN DB", users);

const admin = users.find((u) => u.email === "moshe42410@gmail.com") || users[0];
if (!admin?.has_refresh) {
  log("ABORT", "No refresh token for admin — cannot test OAuth send");
  process.exit(2);
}

const tokenRows = await sql`
  SELECT gmail_refresh_token, gmail_email FROM users WHERE id = ${admin.id}
`;
const refreshToken = tokenRows[0].gmail_refresh_token;
const gmailEmail = tokenRows[0].gmail_email;

// 1) Refresh access token
const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }),
});
const refreshText = await refreshRes.text();
log("GOOGLE TOKEN REFRESH", {
  status: refreshRes.status,
  ok: refreshRes.ok,
  body: refreshText.slice(0, 500),
});

if (!refreshRes.ok) {
  log("CONCLUSION", "OAuth refresh FAILED with local .env.local secrets. Vercel must use the same GOOGLE_CLIENT_SECRET that matches Google Cloud.");
  process.exit(3);
}

const { access_token } = JSON.parse(refreshText);

// 2) Check tokeninfo / scopes
const infoRes = await fetch(
  `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(access_token)}`
);
const infoText = await infoRes.text();
log("TOKEN INFO", { status: infoRes.status, body: infoText.slice(0, 800) });

// 3) Try Gmail API send (preferred path)
const raw = [
  `From: ${gmailEmail}`,
  `To: ${gmailEmail}`,
  `Subject: =?UTF-8?B?${Buffer.from("KLIGER diagnose").toString("base64")}?=`,
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=UTF-8",
  "",
  "KLIGER email diagnose via Gmail API",
].join("\r\n");
const rawB64 = Buffer.from(raw)
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const apiRes = await fetch(
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: rawB64 }),
  }
);
const apiText = await apiRes.text();
log("GMAIL API SEND", { status: apiRes.status, ok: apiRes.ok, body: apiText.slice(0, 500) });

// 4) Try nodemailer SMTP OAuth2 (current app path)
try {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: gmailEmail,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken,
      accessToken: access_token,
    },
  });
  const info = await transporter.sendMail({
    from: gmailEmail,
    to: gmailEmail,
    subject: "KLIGER diagnose SMTP OAuth2",
    text: "diagnose via nodemailer oauth2",
  });
  log("NODEMAILER SMTP OAUTH2", { ok: true, messageId: info.messageId });
} catch (err) {
  log("NODEMAILER SMTP OAUTH2", {
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  });
}

log(
  "SUMMARY",
  {
    refreshOk: refreshRes.ok,
    gmailApiOk: apiRes.ok,
    recommendation: apiRes.ok
      ? "Switch app to Gmail API send (SMTP OAuth path is unreliable)."
      : "Fix OAuth scopes / reconnect Gmail / verify Google Cloud OAuth client.",
  }
);
