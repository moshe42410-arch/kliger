import { NextRequest, NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CONTACT_INBOX = "moshe42410@gmail.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "נדרש שם מלא" },
        { status: 400 }
      );
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "נדרשת כתובת מייל תקינה" },
        { status: 400 }
      );
    }
    if (!message) {
      return NextResponse.json(
        { ok: false, error: "נדרשת הודעה" },
        { status: 400 }
      );
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "שרת המייל לא מוגדר במערכת. אנא הגדר SMTP ב-.env.local כדי לשלוח פניות.",
        },
        { status: 500 }
      );
    }

    const htmlBody = `
      <p><strong>התקבלה פנייה חדשה מטופס &quot;צור קשר&quot; באתר KLIGER</strong></p>
      <hr/>
      <p><strong>שם מלא:</strong> ${escapeHtml(name)}</p>
      <p><strong>אימייל:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
      ${phone ? `<p><strong>טלפון:</strong> <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></p>` : ""}
      ${subject ? `<p><strong>נושא:</strong> ${escapeHtml(subject)}</p>` : ""}
      <hr/>
      <p><strong>תוכן ההודעה:</strong></p>
      <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
    `.trim();

    const currentUser = await getCurrentUser();
    const res = await sendEmail({
      to: [CONTACT_INBOX],
      subject: subject
        ? `פנייה חדשה מ-${name}: ${subject}`
        : `פנייה חדשה מ-${name}`,
      body: htmlBody,
      fromUserId: currentUser?.id ?? null,
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error || "שליחה נכשלה" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "ההודעה נשלחה בהצלחה" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
