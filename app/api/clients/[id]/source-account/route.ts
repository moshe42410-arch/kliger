import { NextRequest, NextResponse } from "next/server";
import { getSql, nowIso, parseClient, type ClientRow } from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const body = await req.json();
    const text = (value: unknown) =>
      typeof value === "string" ? value.trim() : "";
    const sql = getSql();
    const exists = await sql`
      SELECT id FROM clients WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    if (!exists[0]) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }
    await sql`
      UPDATE clients
      SET source_payer_name = ${text(body.payerName) || null},
          source_account_holder = ${text(body.accountHolder) || null},
          source_bank = ${text(body.bank) || null},
          source_branch = ${text(body.branch) || null},
          source_account_number = ${text(body.accountNumber) || null},
          updated_at = ${nowIso()}
      WHERE id = ${params.id}
    `;
    const rows = await sql`SELECT * FROM clients WHERE id = ${params.id}`;
    return NextResponse.json(parseClient(rows[0] as ClientRow));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
