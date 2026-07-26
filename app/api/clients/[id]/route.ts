import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  nowIso,
  parseClient,
  type ClientRow,
  type ReminderChannel,
} from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM clients WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    const row = (rows as ClientRow[])[0];
    if (!row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    return NextResponse.json(parseClient(row));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const body = await req.json();
    const name = String(body.name || "").trim();
    const emails = (Array.isArray(body.emails) ? body.emails : [])
      .map((x: unknown) => String(x || "").trim())
      .filter(Boolean);
    const phones = (Array.isArray(body.phones) ? body.phones : [])
      .map((x: unknown) => String(x || "").trim())
      .filter(Boolean);
    const channel = (body.reminderChannel || "email") as ReminderChannel;
    if (!name) return NextResponse.json({ error: "שם חובה" }, { status: 400 });

    const sql = getSql();
    const existsRows = await sql`
      SELECT id FROM clients WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    if (!existsRows[0]) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    await sql`
      UPDATE clients
      SET name = ${name},
          emails = ${JSON.stringify(emails)},
          phones = ${JSON.stringify(phones)},
          reminder_channel = ${channel},
          updated_at = ${nowIso()}
      WHERE id = ${params.id}
    `;
    const rows = await sql`SELECT * FROM clients WHERE id = ${params.id}`;
    return NextResponse.json(parseClient((rows as ClientRow[])[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    // Use RETURNING to know if anything was deleted (Neon supports this)
    const deleted = await sql`
      DELETE FROM clients WHERE id = ${params.id} AND owner_id = ${ownerId}
      RETURNING id
    `;
    if (!deleted[0]) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
