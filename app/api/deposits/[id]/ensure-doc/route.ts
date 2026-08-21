import { NextResponse } from "next/server";
import { getSql, parseDeposit, type DepositRow } from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";
import { getOrCreateCurrentMonthDocReminder } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * מוודא שיש תזכורת לחודש הנוכחי לצורך סימון בוצע/שולם,
 * גם אם מועד התזכורת עדיין לא הגיע.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM deposits WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    const row = (rows as DepositRow[])[0];
    if (!row) {
      return NextResponse.json({ error: "הפקדה לא נמצאה" }, { status: 404 });
    }
    const deposit = parseDeposit(row);
    const reminder = await getOrCreateCurrentMonthDocReminder(deposit);
    if (!reminder) {
      return NextResponse.json(
        { error: "לא ניתן לפתוח תיעוד לחודש זה" },
        { status: 400 }
      );
    }
    return NextResponse.json({ reminder });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
