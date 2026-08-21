import { NextRequest, NextResponse } from "next/server";
import { getSql, type ClientRow } from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";
import { syncClientDriveFolder } from "@/lib/sync-client-drive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const rows = await sql`
      SELECT id FROM clients WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    if (!(rows as ClientRow[])[0]) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const result = await syncClientDriveFolder(ownerId, params.id);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "סנכרון נכשל", ...result },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
