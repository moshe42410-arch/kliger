import { NextResponse } from "next/server";
import { getSql, nowIso } from "@/lib/db";
import { getCurrentUser, AuthError } from "@/lib/auth";
import { revokeRefreshToken } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError("לא מחובר", 401);
    const sql = getSql();
    const rows = await sql`
      SELECT gmail_refresh_token FROM users WHERE id = ${user.id}
    `;
    const row = rows[0] as { gmail_refresh_token: string | null } | undefined;
    if (row?.gmail_refresh_token) {
      await revokeRefreshToken(row.gmail_refresh_token);
    }
    await sql`
      UPDATE users
      SET gmail_email = NULL,
          gmail_refresh_token = NULL,
          gmail_access_token = NULL,
          gmail_token_expiry = NULL,
          gmail_connected_at = NULL,
          updated_at = ${nowIso()}
      WHERE id = ${user.id}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
