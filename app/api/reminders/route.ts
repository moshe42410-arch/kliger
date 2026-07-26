import { NextResponse } from "next/server";
import { getSql, parseReminder, type ReminderRow } from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM reminders WHERE owner_id = ${ownerId} ORDER BY scheduled_for ASC
    `;
    return NextResponse.json((rows as ReminderRow[]).map(parseReminder));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
