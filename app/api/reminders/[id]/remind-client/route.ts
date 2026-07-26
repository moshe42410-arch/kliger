import { NextRequest, NextResponse } from "next/server";
import { scheduleClientRemind } from "@/lib/reminders";
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
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { error: "מספר ימים לא תקין (1-365)" },
        { status: 400 }
      );
    }
    await scheduleClientRemind(params.id, Math.floor(days));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
