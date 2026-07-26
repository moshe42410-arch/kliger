import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSql, parseAssociation, type AssociationRow } from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM associations WHERE owner_id = ${ownerId} ORDER BY name ASC
    `;
    return NextResponse.json((rows as AssociationRow[]).map(parseAssociation));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
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

    if (!name) return NextResponse.json({ error: "שם העמותה חובה" }, { status: 400 });

    const sql = getSql();
    const id = uuid();
    await sql`
      INSERT INTO associations (id, owner_id, name, email, bank_number, branch_number, account_number, notes)
      VALUES (${id}, ${ownerId}, ${name}, ${email}, ${bankNumber}, ${branchNumber}, ${accountNumber}, ${notes})
    `;

    const rows = await sql`SELECT * FROM associations WHERE id = ${id}`;
    return NextResponse.json(parseAssociation((rows as AssociationRow[])[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
