import { NextRequest, NextResponse } from "next/server";
import { getSql, nowIso, parseUser, type UserRow } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = body.phone ? String(body.phone).trim() : null;
    const companyName = body.companyName
      ? String(body.companyName).trim()
      : null;
    const active = body.active === undefined ? undefined : Boolean(body.active);

    if (!name) return NextResponse.json({ error: "שם חובה" }, { status: 400 });
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "מייל לא תקין" }, { status: 400 });
    }

    const sql = getSql();
    const rows = await sql`SELECT * FROM users WHERE id = ${params.id}`;
    const row = (rows as UserRow[])[0];
    if (!row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    if (row.id === admin.id && active === false) {
      return NextResponse.json(
        { error: "לא ניתן להשבית את המשתמש שלך" },
        { status: 400 }
      );
    }

    if (email !== row.email.toLowerCase()) {
      const dupRows = await sql`
        SELECT id FROM users WHERE lower(email) = lower(${email}) AND id != ${params.id}
      `;
      if (dupRows[0]) {
        return NextResponse.json(
          { error: "כבר קיים משתמש עם מייל זה" },
          { status: 409 }
        );
      }
    }

    const activeValue = active === undefined ? row.active : active ? 1 : 0;
    await sql`
      UPDATE users
      SET name = ${name},
          email = ${email},
          phone = ${phone},
          company_name = ${companyName},
          active = ${activeValue},
          updated_at = ${nowIso()}
      WHERE id = ${params.id}
    `;

    const updRows = await sql`SELECT * FROM users WHERE id = ${params.id}`;
    return NextResponse.json(parseUser((updRows as UserRow[])[0]));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    if (params.id === admin.id) {
      return NextResponse.json(
        { error: "לא ניתן למחוק את המשתמש שלך" },
        { status: 400 }
      );
    }
    const sql = getSql();
    const deleted = await sql`
      DELETE FROM users WHERE id = ${params.id} RETURNING id
    `;
    if (!deleted[0]) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
