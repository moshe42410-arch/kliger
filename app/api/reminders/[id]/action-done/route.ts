import { NextRequest, NextResponse } from "next/server";
import { markReminderActionDone, getReminderById } from "@/lib/reminders";
import { assertReminderOwnership, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await assertReminderOwnership(params.id);
    let done = true;
    try {
      const body = await req.json();
      if (typeof body?.on === "boolean") done = body.on;
    } catch {
      // גוף ריק = סימון כבוצע
    }
    await markReminderActionDone(params.id, done);
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
