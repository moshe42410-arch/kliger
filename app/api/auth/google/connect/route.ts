import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getOAuthEnv, buildAuthUrl } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "kliger_google_oauth_state";

/**
 * שני מצבים:
 *   1. mode=connect (ברירת מחדל) — משתמש קיים ומחובר, מחבר את חשבון הגוגל שלו
 *      לצורך שליחת מיילים.
 *   2. mode=login — משתמש לא מחובר, מתחבר עם גוגל. אחרי חזרה מגוגל,
 *      נאתר משתמש קיים במערכת לפי המייל שלו ונפתח לו session.
 *
 * ה-state cookie שומר את המצב כך שה-callback ידע איך להגיב.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "login" ? "login" : "connect";
  const appBase = process.env.APP_URL || url.origin;

  const env = getOAuthEnv();
  if (!env) {
    const backTo =
      mode === "login"
        ? "/login?notice=oauth_not_configured"
        : "/settings?tab=email&notice=oauth_not_configured";
    return NextResponse.redirect(new URL(backTo, appBase));
  }

  let stateValue: string;
  if (mode === "login") {
    // מצב login — אין משתמש מחובר, אין צורך ב־user_id ב-state.
    const state = randomBytes(24).toString("hex");
    stateValue = `${state}.login`;
  } else {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(new URL("/login", appBase));
    }
    const state = randomBytes(24).toString("hex");
    stateValue = `${state}.connect.${user.id}`;
  }

  cookies().set(STATE_COOKIE, stateValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  // ה־state שנשלח לגוגל = החלק הראשון בלבד (הרנדומלי). הקוקי מכיל את המצב.
  const stateForGoogle = stateValue.split(".")[0];
  return NextResponse.redirect(buildAuthUrl(stateForGoogle, env));
}
