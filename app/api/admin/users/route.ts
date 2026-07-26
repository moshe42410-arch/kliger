import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSql, parseUser, type UserRow } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth";
import { hashPassword, generateTempPassword } from "@/lib/auth-crypto";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const sql = getSql();
    const rows = await sql`SELECT * FROM users ORDER BY role DESC, created_at ASC`;
    return NextResponse.json((rows as UserRow[]).map(parseUser));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * יצירת יועץ חדש: אימייל, שם, ואופציונלית שם חברה+טלפון.
 * המערכת מייצרת סיסמה זמנית ושולחת מייל הזמנה.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const companyName = body.companyName
      ? String(body.companyName).trim()
      : null;

    if (!name) {
      return NextResponse.json({ error: "שם היועץ חובה" }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "מייל לא תקין" }, { status: 400 });
    }

    const sql = getSql();
    const existing = (await sql`
      SELECT id FROM users WHERE lower(email) = lower(${email})
    `) as Array<{ id: string }>;
    if (existing[0]) {
      return NextResponse.json(
        { error: "משתמש עם מייל זה כבר קיים" },
        { status: 409 }
      );
    }

    const tempPassword = generateTempPassword();
    const passwordHash = hashPassword(tempPassword);
    const id = uuid();

    await sql`
      INSERT INTO users (
        id, email, name, password_hash, must_change_password,
        role, active, phone, company_name
      ) VALUES (
        ${id}, ${email}, ${name}, ${passwordHash}, 1,
        'advisor', 1, ${phone}, ${companyName}
      )
    `;

    const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const loginUrl = `${appUrl}/login`;

    const subject = "פתיחת חשבון במערכת KLIGER";
    const bodyLines = [
      `שלום ${name},`,
      "",
      `פתחנו עבורך משתמש חדש במערכת KLIGER — מערכת ניהול תזכורות והפקדות ליועצים.`,
      "",
      `כתובת המערכת: ${loginUrl}`,
      `שם משתמש (מייל): ${email}`,
      `סיסמה זמנית: ${tempPassword}`,
      "",
      `בכניסה הראשונה תתבקש/י להחליף את הסיסמה הזמנית.`,
      companyName
        ? `אחרי הכניסה תוכל/י להעלות לוגו ולעדכן פרטי חברה (מוגדרים כעת: ${companyName}).`
        : `אחרי הכניסה תוכל/י להעלות לוגו ולעדכן פרטי חברה.`,
      "",
      `אנא שמור/י מייל זה בסודיות — הוא מכיל את הסיסמה הראשונית שלך.`,
      "",
      "בברכה,",
      admin.name,
    ];
    const emailBody = bodyLines.filter((l) => l !== null).join("\n");

    const emailRes = await sendEmail({
      to: [email],
      subject,
      body: emailBody,
      fromUserId: admin.id,
      brandName: admin.companyName || admin.name || "KLIGER",
    });

    const createdRows = await sql`SELECT * FROM users WHERE id = ${id}`;
    const created = (createdRows as UserRow[])[0];
    return NextResponse.json({
      user: parseUser(created),
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
