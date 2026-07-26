import { NextRequest, NextResponse } from "next/server";
import { snoozeReminder } from "@/lib/reminders";
import { assertReminderOwnership, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await assertReminderOwnership(params.id);
    const body = await req.json();
    const days = Number(body.days);
    if (!isFinite(days) || days < 1) {
      return NextResponse.json({ error: "מספר ימים לא תקין" }, { status: 400 });
    }
    await snoozeReminder(params.id, Math.floor(days));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
