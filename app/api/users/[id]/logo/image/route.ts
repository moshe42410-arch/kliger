import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSql } from "@/lib/db";
import { getBlobBytes } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";

/**
 * Public: serves the advisor's logo (by id). Used by public upload pages,
 * email signatures, etc. Exposes no sensitive data.
 *
 * Behavior:
 * - If logo_filename is a full URL (Vercel Blob) → redirect to it.
 * - Otherwise (local dev) → read from ./uploads/logos/<filename>.
 */

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sql = getSql();
  const rows = await sql`SELECT logo_filename FROM users WHERE id = ${params.id}`;
  const row = rows[0] as { logo_filename: string | null } | undefined;
  if (!row?.logo_filename)
    return NextResponse.json({ error: "אין לוגו" }, { status: 404 });

  if (row.logo_filename.startsWith("http")) {
    return NextResponse.redirect(row.logo_filename, 302);
  }

  const buf = await getBlobBytes(row.logo_filename);
  if (!buf) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

  const ext = path.extname(row.logo_filename).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=60",
    },
  });
}
