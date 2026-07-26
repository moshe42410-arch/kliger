import { NextResponse } from "next/server";

/**
 * Simple health check endpoint for Vercel/uptime monitors.
 * Returns 200 OK when the app is up and can reach the DB.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = getSql();
    await sql`SELECT 1 AS ok`;
    return NextResponse.json({
      status: "ok",
      time: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
