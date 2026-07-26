/**
 * Google OAuth2 flow — טהור, ללא תלות חיצונית (עובד עם fetch מובנה).
 *
 * דורש שלושה משתני סביבה:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI  (מומלץ: {APP_URL}/api/auth/google/callback)
 *
 * ה־scope שאנחנו מבקשים: `gmail.send` בלבד (שליחה מטעם המשתמש, בלי קריאת דואר).
 * מבקשים `access_type=offline` + `prompt=consent` כדי לקבל refresh_token.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export interface OAuthEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getOAuthEnv(): OAuthEnv | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    (process.env.APP_URL
      ? `${process.env.APP_URL.replace(/\/$/, "")}/api/auth/google/callback`
      : "");
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthUrl(state: string, env: OAuthEnv): string {
  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface TokenExchangeResult {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(
  code: string,
  env: OAuthEnv
): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as TokenExchangeResult;
}

export async function fetchGoogleEmail(
  accessToken: string
): Promise<string | null> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { email?: string };
  return j.email ?? null;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
  } catch {
    // best-effort — אם ההעברה נכשלת נמחק בכל מקרה מ־DB
  }
}
