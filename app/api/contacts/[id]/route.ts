import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  nowIso,
  parseContact,
  type ContactRow,
} from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = body.email ? String(body.email).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!name) {
      return NextResponse.json({ error: "שם איש הקשר חובה" }, { status: 400 });
    }
    if (email && !email.includes("@")) {
      return NextResponse.json({ error: "מייל לא תקין" }, { status: 400 });
    }

    const sql = getSql();
    const existing = await sql`
      SELECT id FROM contacts WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    if (!(existing as { id: string }[])[0]) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    await sql`
      UPDATE contacts
      SET name = ${name},
          email = ${email},
          phone = ${phone},
          notes = ${notes},
          updated_at = ${nowIso()}
      WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    const rows = await sql`SELECT * FROM contacts WHERE id = ${params.id}`;
    return NextResponse.json(parseContact((rows as ContactRow[])[0]));
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
    await sql`
      DELETE FROM contacts WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
