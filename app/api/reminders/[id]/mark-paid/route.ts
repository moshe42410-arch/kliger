import { NextRequest, NextResponse } from "next/server";
import { markReminderPaid, getReminderById } from "@/lib/reminders";
import { assertReminderOwnership, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await assertReminderOwnership(params.id);
    let paid = true;
    try {
      const body = await req.json();
      if (typeof body?.on === "boolean") paid = body.on;
    } catch {
      // גוף ריק = סימון כשולם
    }
    await markReminderPaid(params.id, paid);
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
