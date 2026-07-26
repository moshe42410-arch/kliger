import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  parseClient,
  parseReminder,
  type ClientRow,
  type ReminderRow,
} from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { logMessage } from "@/lib/reminders";
import { assertReminderOwnership, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { ownerId } = await assertReminderOwnership(params.id);
    const body = await req.json();
    const subject = String(body.subject || "הודעה מ-KLIGER");
    const message = String(body.message || "");
    if (!message.trim()) {
      return NextResponse.json({ error: "תוכן ההודעה חובה" }, { status: 400 });
    }

    const sql = getSql();
    const rRows = await sql`SELECT * FROM reminders WHERE id = ${params.id}`;
    const rRow = (rRows as ReminderRow[])[0];
    if (!rRow) return NextResponse.json({ error: "תזכורת לא נמצאה" }, { status: 404 });
    const reminder = parseReminder(rRow);

    const cRows = await sql`SELECT * FROM clients WHERE id = ${reminder.clientId}`;
    const cRow = (cRows as ClientRow[])[0];
    if (!cRow) return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    const client = parseClient(cRow);

    const res = await sendEmail({
      to: client.emails,
      subject,
      body: message,
      reminderId: reminder.id,
      clientId: client.id,
      fromUserId: ownerId,
    });

    await logMessage({
      reminderId: reminder.id,
      direction: "out",
      subject,
      body: message,
      emailStatus: res.ok ? "sent" : "error",
      emailError: res.error ?? null,
      metadata: { to: client.emails, type: "advisor-message" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: res.error || "שליחה נכשלה" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
