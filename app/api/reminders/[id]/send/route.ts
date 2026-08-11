import { NextRequest, NextResponse } from "next/server";
import { sendReminderNow, type SendAudience } from "@/lib/reminders";
import { assertReminderOwnership, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await assertReminderOwnership(params.id);
    let audience: SendAudience = "advisor";
    try {
      const body = await req.json();
      if (body?.to === "client") audience = "client";
      else if (body?.to === "both") audience = "both";
      else if (body?.to === "advisor") audience = "advisor";
    } catch {
      // no body — default advisor
    }
    const res = await sendReminderNow(params.id, { audience });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error || "שליחה נכשלה" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, sentTo: res.sentTo });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
