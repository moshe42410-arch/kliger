import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";
import { getBlobBytes } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Serves a client-uploaded document (attachment) back to the advisor.
 * Auth: the advisor who owns the upload only.
 *
 * Behavior:
 *  - If `filename` in DB is a full URL (Vercel Blob) — 302 redirect to it.
 *  - Otherwise (local dev) — stream bytes from local uploads dir.
 *
 * Query flags:
 *  - `?download=1` sets Content-Disposition to attachment.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const rows = await sql`
      SELECT filename, original_name, mime_type
      FROM uploads
      WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    const row = rows[0] as
      | { filename: string; original_name: string; mime_type: string | null }
      | undefined;
    if (!row) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const asDownload = req.nextUrl.searchParams.get("download") === "1";

    if (row.filename.startsWith("http")) {
      if (!asDownload) {
        return NextResponse.redirect(row.filename, 302);
      }
      // For download-mode with blob URL: proxy through so we can set Content-Disposition
      const upstream = await fetch(row.filename);
      if (!upstream.ok) {
        return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": row.mime_type || "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
        },
      });
    }

    // Local dev — read from disk
    const buf = await getBlobBytes(row.filename);
    if (!buf) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    const headers: Record<string, string> = {
      "Content-Type": row.mime_type || "application/octet-stream",
    };
    if (asDownload) {
      headers["Content-Disposition"] =
        `attachment; filename*=UTF-8''${encodeURIComponent(row.original_name)}`;
    }
    return new NextResponse(new Uint8Array(buf), { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
