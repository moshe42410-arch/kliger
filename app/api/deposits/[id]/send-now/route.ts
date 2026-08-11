import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  parseDeposit,
  parseReminder,
  type DepositRow,
  type ReminderRow,
} from "@/lib/db";
import { ensureRemindersForDeposit, sendReminderNow } from "@/lib/reminders";
import { getCurrentOwnerId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let ownerId: string;
    try {
      ownerId = await getCurrentOwnerId();
    } catch {
      return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    }

    let to: "advisor" | "client" | "both" = "advisor";
    try {
      const body = await req.json();
      if (body?.to === "client" || body?.to === "both" || body?.to === "advisor") {
        to = body.to;
      }
    } catch {
      // no body
    }

    const sql = getSql();
    const rows = await sql`
      SELECT * FROM deposits WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    const row = (rows as DepositRow[])[0];
    if (!row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    const deposit = parseDeposit(row);

    await ensureRemindersForDeposit(deposit, { force: true });

    // Any open reminder for this deposit — no daily throttle / paid filter blocking send
    let rems = await sql`
      SELECT * FROM reminders
      WHERE deposit_id = ${params.id}
        AND owner_id = ${ownerId}
        AND status NOT IN ('resolved')
      ORDER BY
        CASE WHEN phase = 'primary' THEN 0 ELSE 1 END,
        target_date ASC
    `;
    let reminders = (rems as ReminderRow[]).map(parseReminder);

    if (reminders.length === 0) {
      // Last resort: create for current month even outside normal window
      await ensureRemindersForDeposit(deposit, { force: true });
      rems = await sql`
        SELECT * FROM reminders
        WHERE deposit_id = ${params.id}
          AND owner_id = ${ownerId}
          AND status NOT IN ('resolved')
        ORDER BY target_date ASC
      `;
      reminders = (rems as ReminderRow[]).map(parseReminder);
    }

    if (reminders.length === 0) {
      return NextResponse.json(
        { error: "לא נמצאה תזכורת פעילה — בדוק תאריכי התחלה/סיום של ההפקדה" },
        { status: 400 }
      );
    }

    let sent = 0;
    const errors: string[] = [];
    // Send the most relevant open reminder (primary first), no send-count limit
    const target = reminders[0];
    const res = await sendReminderNow(target.id, { audience: to });
    if (res.ok) sent++;
    else if (res.error) errors.push(res.error);

    if (sent === 0) {
      const msg = errors[0] || "שליחה נכשלה";
      const needsGmail =
        msg.includes("גוגל") || msg.includes("Gmail") || msg.includes("SMTP");
      return NextResponse.json(
        { error: msg },
        { status: needsGmail ? 400 : 500 }
      );
    }
    return NextResponse.json({ ok: true, sent, errors, reminderId: target.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
