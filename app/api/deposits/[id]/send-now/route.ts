import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  parseDeposit,
  type DepositRow,
  type ReminderRow,
} from "@/lib/db";
import { ensureRemindersForDeposit, sendReminderNow } from "@/lib/reminders";
import { getCurrentOwnerId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let ownerId: string;
    try {
      ownerId = await getCurrentOwnerId();
    } catch {
      return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    }
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM deposits WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    const row = (rows as DepositRow[])[0];
    if (!row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    const deposit = parseDeposit(row);

    await ensureRemindersForDeposit(deposit, { force: true });

    const monthBucket = new Date().toISOString().slice(0, 7);
    const rems = await sql`
      SELECT * FROM reminders
      WHERE deposit_id = ${params.id}
        AND owner_id = ${ownerId}
        AND status NOT IN ('resolved')
        AND paid_at IS NULL
        AND month_bucket = ${monthBucket}
      ORDER BY target_date ASC, phase ASC
    `;
    const reminders = rems as ReminderRow[];

    if (reminders.length === 0) {
      return NextResponse.json(
        { error: "לא נמצאה תזכורת פעילה" },
        { status: 400 }
      );
    }

    let sent = 0;
    const errors: string[] = [];
    for (const r of reminders) {
      const res = await sendReminderNow(r.id);
      if (res.ok) sent++;
      else if (res.error) errors.push(res.error);
    }

    if (sent === 0) {
      const msg = errors[0] || "שליחה נכשלה";
      const needsGmail =
        msg.includes("גוגל") || msg.includes("Gmail") || msg.includes("SMTP");
      return NextResponse.json(
        { error: msg },
        { status: needsGmail ? 400 : 500 }
      );
    }
    return NextResponse.json({ ok: true, sent, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
