import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  parseClient,
  parseReminder,
  type ClientRow,
  type ReminderRow,
} from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  getMessagesFor,
  logMessage,
  recordClientResponse,
} from "@/lib/reminders";
import { assertReminderOwnership, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await assertReminderOwnership(params.id);
    const messages = await getMessagesFor(params.id);
    return NextResponse.json(messages);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { ownerId } = await assertReminderOwnership(params.id);
    const body = await req.json();
    const direction = String(body.direction || "out");
    const subject = body.subject ? String(body.subject) : null;
    const msgBody = String(body.body || "").trim();
    if (!msgBody) {
      return NextResponse.json(
        { error: "תוכן ההודעה חובה" },
        { status: 400 }
      );
    }

    const sql = getSql();
    const rRows = await sql`SELECT * FROM reminders WHERE id = ${params.id}`;
    const rRow = (rRows as ReminderRow[])[0];
    if (!rRow) {
      return NextResponse.json({ error: "תזכורת לא נמצאה" }, { status: 404 });
    }
    const reminder = parseReminder(rRow);

    if (direction === "in") {
      const msg = await recordClientResponse(reminder.id, msgBody, {
        type: "manual-recording",
        subject: subject || undefined,
      });
      return NextResponse.json(msg);
    }

    const cRows = await sql`SELECT * FROM clients WHERE id = ${reminder.clientId}`;
    const cRow = (cRows as ClientRow[])[0];
    if (!cRow) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }
    const client = parseClient(cRow);

    const finalSubject = subject || "הודעה מ-KLIGER";
    const res = await sendEmail({
      to: client.emails,
      subject: finalSubject,
      body: msgBody,
      reminderId: reminder.id,
      clientId: client.id,
      fromUserId: ownerId,
    });

    const msg = await logMessage({
      reminderId: reminder.id,
      direction: "out",
      subject: finalSubject,
      body: msgBody,
      emailStatus: res.ok ? "sent" : "error",
      emailError: res.error ?? null,
      metadata: { to: client.emails, type: "chat-reply" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: res.error || "המייל לא נשלח", message: msg },
        { status: 500 }
      );
    }
    return NextResponse.json(msg);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
