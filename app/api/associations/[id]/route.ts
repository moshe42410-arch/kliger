import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  nowIso,
  parseAssociation,
  type AssociationRow,
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
    const bankNumber = body.bankNumber ? String(body.bankNumber).trim() : null;
    const branchNumber = body.branchNumber
      ? String(body.branchNumber).trim()
      : null;
    const accountNumber = body.accountNumber
      ? String(body.accountNumber).trim()
      : null;
    const notes = body.notes ? String(body.notes) : null;

    if (!name) return NextResponse.json({ error: "שם חובה" }, { status: 400 });

    const sql = getSql();
    const existsRows = (await sql`
      SELECT id FROM associations WHERE id = ${params.id} AND owner_id = ${ownerId}
    `) as Array<{ id: string }>;
    if (!existsRows[0]) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    await sql`
      UPDATE associations
      SET name = ${name},
          email = ${email},
          bank_number = ${bankNumber},
          branch_number = ${branchNumber},
          account_number = ${accountNumber},
          notes = ${notes},
          updated_at = ${nowIso()}
      WHERE id = ${params.id}
    `;

    const rows = await sql`SELECT * FROM associations WHERE id = ${params.id}`;
    return NextResponse.json(parseAssociation((rows as AssociationRow[])[0]));
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
    const deleted = (await sql`
      DELETE FROM associations WHERE id = ${params.id} AND owner_id = ${ownerId}
      RETURNING id
    `) as Array<{ id: string }>;
    if (!deleted[0]) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
