import { NextRequest, NextResponse } from "next/server";
import { setReminderStatus } from "@/lib/reminders";
import { assertReminderOwnership, AuthError } from "@/lib/auth";
import { getSql, nowIso } from "@/lib/db";
import type { ReminderStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED: ReminderStatus[] = [
  "waiting_client",
  "waiting_advisor",
  "waiting_association",
  "snoozed",
  "resolved",
  "carried_over",
];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await assertReminderOwnership(params.id);
    const body = await req.json();
    const status = body.status as ReminderStatus;
    if (!ALLOWED.includes(status)) {
      return NextResponse.json({ error: "סטטוס לא תקין" }, { status: 400 });
    }

    await setReminderStatus(params.id, status);

    if (status !== "snoozed") {
      const sql = getSql();
      await sql`
        UPDATE reminders SET snooze_until = NULL, updated_at = ${nowIso()}
        WHERE id = ${params.id}
      `;
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
