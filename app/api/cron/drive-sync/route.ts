import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { syncAllDriveFolders } = await import("@/lib/sync-client-drive");
    const result = await syncAllDriveFolders();
    return NextResponse.json({
      ok: true,
      ...result,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/drive-sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
