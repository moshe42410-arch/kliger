import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import {
  getSql,
  nowIso,
  parseContact,
  type ContactRow,
} from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM contacts WHERE owner_id = ${ownerId} ORDER BY name ASC
    `;
    return NextResponse.json((rows as ContactRow[]).map(parseContact));
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
    const phone = body.phone ? String(body.phone).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!name) {
      return NextResponse.json({ error: "שם איש הקשר חובה" }, { status: 400 });
    }
    if (email && !email.includes("@")) {
      return NextResponse.json({ error: "מייל לא תקין" }, { status: 400 });
    }

    const sql = getSql();
    const id = uuid();
    await sql`
      INSERT INTO contacts (id, owner_id, name, email, phone, notes)
      VALUES (${id}, ${ownerId}, ${name}, ${email}, ${phone}, ${notes})
    `;
    const rows = await sql`SELECT * FROM contacts WHERE id = ${id}`;
    return NextResponse.json(parseContact((rows as ContactRow[])[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
