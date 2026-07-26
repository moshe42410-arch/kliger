import { NextRequest, NextResponse } from "next/server";
import { markReminderResolved } from "@/lib/reminders";
import { assertReminderOwnership, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await assertReminderOwnership(params.id);
    await markReminderResolved(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
