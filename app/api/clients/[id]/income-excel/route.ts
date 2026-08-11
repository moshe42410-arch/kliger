import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  nowIso,
  parseClient,
  type ClientRow,
} from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";
import { parseConversationSummaryBuffer } from "@/lib/parse-conversation-summary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const exists = (await sql`
      SELECT id FROM clients WHERE id = ${params.id} AND owner_id = ${ownerId}
    `) as Array<{ id: string }>;
    if (!exists[0]) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "יש לצרף קובץ אקסל" }, { status: 400 });
    }
    const name = file.name || "סיכום שיחה.xlsx";
    if (!/\.xlsx?$/i.test(name)) {
      return NextResponse.json(
        { error: "יש להעלות קובץ Excel (.xlsx)" },
        { status: 400 }
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "הקובץ גדול מדי (עד 8MB)" }, { status: 400 });
    }

    const existingRows = (await sql`
      SELECT income_snapshot FROM clients WHERE id = ${params.id}
    `) as Array<{ income_snapshot: string | null }>;
    let amountPer100k: number | null = null;
    try {
      const prev = existingRows[0]?.income_snapshot
        ? JSON.parse(existingRows[0].income_snapshot)
        : null;
      if (prev?.amountPer100k != null && Number.isFinite(Number(prev.amountPer100k))) {
        amountPer100k = Number(prev.amountPer100k);
      }
    } catch {
      /* ignore */
    }

    const snapshot = {
      ...parseConversationSummaryBuffer(buf),
      amountPer100k,
    };
    const snapshotAt = nowIso();
    await sql`
      UPDATE clients
      SET income_snapshot = ${JSON.stringify(snapshot)},
          income_snapshot_at = ${snapshotAt},
          income_source_filename = ${name},
          updated_at = ${snapshotAt}
      WHERE id = ${params.id}
    `;

    const rows = await sql`SELECT * FROM clients WHERE id = ${params.id}`;
    return NextResponse.json(parseClient((rows as ClientRow[])[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
