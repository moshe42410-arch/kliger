import { NextRequest, NextResponse } from "next/server";

/**
 * Daily reminder sweep — invoked by Vercel Cron (see vercel.json).
 *
 * Vercel Cron GET's this endpoint on the schedule you set. It sends an
 * `Authorization: Bearer <CRON_SECRET>` header. We verify it before running.
 *
 * Locally you can hit this via:
 *   curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/reminders
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // seconds

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  // In production, refuse without a secret. In dev, allow open access.
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runDailyReminderSweep } = await import("@/lib/reminders");
    const result = await runDailyReminderSweep();
    return NextResponse.json({ ok: true, result, at: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/reminders] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
