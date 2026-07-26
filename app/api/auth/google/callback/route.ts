import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSql, getUserByEmail, nowIso } from "@/lib/db";
import { getCurrentUser, createSession } from "@/lib/auth";
import {
  getOAuthEnv,
  exchangeCodeForTokens,
  fetchGoogleEmail,
} from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "kliger_google_oauth_state";

function baseUrl(req: NextRequest): string {
  return process.env.APP_URL || req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  const jar = cookies();
  const stateCookie = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  const cookieParts = stateCookie?.split(".") || [];
  const savedRand = cookieParts[0];
  const savedMode = cookieParts[1];
  const savedUserId = cookieParts[2];

  const isLogin = savedMode === "login";

  const backToConnect = (notice: string) =>
    NextResponse.redirect(
      new URL(`/settings?tab=email&notice=${notice}`, baseUrl(req))
    );
  const backToLogin = (notice: string) =>
    NextResponse.redirect(new URL(`/login?notice=${notice}`, baseUrl(req)));
  const backTo = (notice: string) =>
    isLogin ? backToLogin(notice) : backToConnect(notice);

  if (errParam) return backTo(`google_error`);
  if (!code || !state) return backTo("google_error");
  if (!stateCookie || !savedRand) return backTo("state_mismatch");
  if (savedRand !== state) return backTo("state_mismatch");

  const env = getOAuthEnv();
  if (!env) return backTo("oauth_not_configured");

  try {
    const tokens = await exchangeCodeForTokens(code, env);
    const gmailAddress = await fetchGoogleEmail(tokens.access_token);
    if (!gmailAddress) {
      return backTo("google_error");
    }

    const sql = getSql();

    if (isLogin) {
      /* -------- LOGIN FLOW -------- */
      const existing = await getUserByEmail(gmailAddress);
      if (!existing) {
        return backToLogin("google_no_user");
      }
      if (!existing.active) {
        return backToLogin("google_inactive");
      }

      const expiryIso = new Date(
        Date.now() + (tokens.expires_in - 60) * 1000
      ).toISOString();

      if (tokens.refresh_token) {
        await sql`
          UPDATE users
          SET gmail_email = ${gmailAddress},
              gmail_refresh_token = ${tokens.refresh_token},
              gmail_access_token = ${tokens.access_token},
              gmail_token_expiry = ${expiryIso},
              gmail_connected_at = ${nowIso()},
              updated_at = ${nowIso()}
          WHERE id = ${existing.id}
        `;
      } else {
        await sql`
          UPDATE users
          SET gmail_email = COALESCE(gmail_email, ${gmailAddress}),
              gmail_access_token = ${tokens.access_token},
              gmail_token_expiry = ${expiryIso},
              updated_at = ${nowIso()}
          WHERE id = ${existing.id}
        `;
      }

      await createSession(existing.id);

      if (existing.mustChangePassword) {
        return NextResponse.redirect(new URL("/change-password", baseUrl(req)));
      }
      return NextResponse.redirect(new URL("/", baseUrl(req)));
    }

    /* -------- CONNECT FLOW -------- */
    if (!tokens.refresh_token) {
      return backToConnect("google_error");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.id !== savedUserId) {
      return backToConnect("state_mismatch");
    }

    const expiryIso = new Date(
      Date.now() + (tokens.expires_in - 60) * 1000
    ).toISOString();

    await sql`
      UPDATE users
      SET gmail_email = ${gmailAddress},
          gmail_refresh_token = ${tokens.refresh_token},
          gmail_access_token = ${tokens.access_token},
          gmail_token_expiry = ${expiryIso},
          gmail_connected_at = ${nowIso()},
          updated_at = ${nowIso()}
      WHERE id = ${currentUser.id}
    `;

    return NextResponse.redirect(
      new URL(`/settings?tab=email&notice=connected`, baseUrl(req))
    );
  } catch (err) {
    console.error("[google oauth callback]", err);
    return backTo("google_error");
  }
}
