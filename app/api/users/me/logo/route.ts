import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSql, nowIso } from "@/lib/db";
import { getCurrentUser, AuthError } from "@/lib/auth";
import { putLogo, deleteBlob } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError("לא מחובר", 401);

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
    }

    const allowed = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/svg+xml",
    ];
    if (file.type && !allowed.includes(file.type)) {
      return NextResponse.json(
        { error: "סוג קובץ לא נתמך (PNG/JPG/SVG/WEBP)" },
        { status: 400 }
      );
    }

    if (user.logoFilename) {
      try {
        await deleteBlob(user.logoFilename);
      } catch {
        /* ignore */
      }
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name || "") || ".png";
    const safe = `${uuid()}${ext.toLowerCase()}`;
    const stored = await putLogo(safe, buf, file.type || undefined);
    // Store the raw key (filename in dev, URL in prod). The image route
    // handles both — if it starts with `http`, redirects; else reads from disk.
    const dbValue = stored.key;

    const sql = getSql();
    await sql`
      UPDATE users SET logo_filename = ${dbValue}, updated_at = ${nowIso()}
      WHERE id = ${user.id}
    `;

    return NextResponse.json({ ok: true, logoFilename: dbValue });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError("לא מחובר", 401);
    if (user.logoFilename) {
      try {
        await deleteBlob(user.logoFilename);
      } catch {
        /* ignore */
      }
    }
    const sql = getSql();
    await sql`
      UPDATE users SET logo_filename = NULL, updated_at = ${nowIso()}
      WHERE id = ${user.id}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
