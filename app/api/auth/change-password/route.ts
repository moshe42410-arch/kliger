import { NextRequest, NextResponse } from "next/server";
import { getSql, getUserByEmail, nowIso } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth-crypto";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    }
    const body = await req.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "סיסמה חדשה חייבת להכיל 8 תווים לפחות" },
        { status: 400 }
      );
    }
    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "הסיסמה החדשה חייבת להיות שונה מהקודמת" },
        { status: 400 }
      );
    }

    const withHash = await getUserByEmail(user.email);
    if (!withHash || !verifyPassword(currentPassword, withHash.passwordHash)) {
      return NextResponse.json(
        { error: "הסיסמה הנוכחית שגויה" },
        { status: 401 }
      );
    }

    const newHash = hashPassword(newPassword);
    const sql = getSql();
    await sql`
      UPDATE users
      SET password_hash = ${newHash}, must_change_password = 0, updated_at = ${nowIso()}
      WHERE id = ${user.id}
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
