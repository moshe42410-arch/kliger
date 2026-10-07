import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaExtras, getSql, nowIso } from "@/lib/db";
import { assertReminderOwnership, AuthError } from "@/lib/auth";
import { getReminderById, logMessage } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSchemaExtras();
    await assertReminderOwnership(params.id);
    const body = await req.json().catch(() => ({}));
    const payerName =
      typeof body.payerName === "string" ? body.payerName.trim() : "";
    const sql = getSql();
    const now = nowIso();
    if (payerName) {
      await sql`
        UPDATE reminders
        SET payer_name = ${payerName}, updated_at = ${now}
        WHERE id = ${params.id}
      `;
    } else {
      await sql`
        UPDATE reminders
        SET payer_name = NULL, updated_at = ${now}
        WHERE id = ${params.id}
      `;
    }
    await logMessage({
      reminderId: params.id,
      direction: "system",
      subject: payerName ? "שם מעביר עודכן" : "שם מעביר נמחק",
      body: payerName
        ? `שם המעביר לחודש זה: ${payerName}`
        : "שם המעביר נמחק מהחודש הזה.",
      metadata: { kind: "payer_name", payerName: payerName || null },
    });
    const reminder = await getReminderById(params.id);
    return NextResponse.json({ ok: true, reminder });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
