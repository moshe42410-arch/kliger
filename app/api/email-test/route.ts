import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { ok: false, error: "SMTP לא מוגדר - חסרים SMTP_HOST/USER/PASSWORD" },
      { status: 400 }
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: (process.env.SMTP_SECURE ?? "true") === "true",
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASSWORD!,
      },
    });
    await transporter.verify();
    return NextResponse.json({
      ok: true,
      message: "חיבור SMTP תקין",
      host: process.env.SMTP_HOST,
      user: process.env.SMTP_USER,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const to = String(body.to || "").trim();
    if (!to || !to.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "נדרש שדה 'to' עם כתובת מייל תקינה" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });
    }
    const res = await sendEmail({
      to: [to],
      subject: "בדיקת מערכת KLIGER",
      body: `שלום,

זהו מייל בדיקה ממערכת KLIGER שלך.

אם קיבלת את המייל הזה - זה אומר שהחיבור למייל שלך תקין והתזכורות האוטומטיות יישלחו ללקוחות שלך כמתוכנן.

בהצלחה!
מערכת KLIGER`,
      fromUserId: user.id,
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error || "שליחה נכשלה" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, message: `מייל בדיקה נשלח אל ${to}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
