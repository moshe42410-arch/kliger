import { NextRequest, NextResponse } from "next/server";
import { getSql, nowIso, parseUser, type UserRow } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth";
import { hashPassword, generateTempPassword } from "@/lib/auth-crypto";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const sql = getSql();
    const rows = await sql`SELECT * FROM users WHERE id = ${params.id}`;
    const row = (rows as UserRow[])[0];
    if (!row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    const tempPassword = generateTempPassword();
    await sql`
      UPDATE users
      SET password_hash = ${hashPassword(tempPassword)},
          must_change_password = 1,
          updated_at = ${nowIso()}
      WHERE id = ${params.id}
    `;

    await sql`DELETE FROM sessions WHERE user_id = ${params.id}`;

    const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const loginUrl = `${appUrl}/login`;
    const subject = "איפוס סיסמה במערכת KLIGER";
    const body = [
      `שלום ${row.name},`,
      "",
      `המנהל איפס את הסיסמה שלך במערכת KLIGER.`,
      "",
      `כתובת המערכת: ${loginUrl}`,
      `מייל: ${row.email}`,
      `סיסמה זמנית חדשה: ${tempPassword}`,
      "",
      `בכניסה הבאה תתבקש/י להחליף אותה לסיסמה קבועה.`,
      "",
      "בברכה,",
      admin.name,
    ].join("\n");

    const emailRes = await sendEmail({
      to: [row.email],
      subject,
      body,
      fromUserId: admin.id,
      brandName: admin.companyName || admin.name || "KLIGER",
    });

    return NextResponse.json({
      ok: true,
      user: parseUser(row),
      emailSent: emailRes.ok,
      emailError: emailRes.error ?? null,
      tempPassword: emailRes.ok ? null : tempPassword,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
