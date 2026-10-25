import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";
import { getBlobBytes } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function sniffContentType(
  name: string,
  mime: string | null,
  buf: Buffer
): string {
  const given = (mime || "").toLowerCase();
  if (given && given !== "application/octet-stream") return given;
  const lower = name.toLowerCase();
  const head = buf.subarray(0, 12);
  if (lower.endsWith(".pdf") || head.subarray(0, 4).toString() === "%PDF") {
    return "application/pdf";
  }
  if (lower.endsWith(".png") || head.subarray(0, 4).toString("hex") === "89504e47") {
    return "image/png";
  }
  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    head.subarray(0, 3).toString("hex") === "ffd8ff"
  ) {
    return "image/jpeg";
  }
  if (lower.endsWith(".webp") || head.subarray(0, 4).toString() === "RIFF") {
    return "image/webp";
  }
  if (lower.endsWith(".gif") || head.subarray(0, 3).toString() === "GIF") {
    return "image/gif";
  }
  return given || "application/octet-stream";
}

/**
 * Serves a client-uploaded document (attachment) back to the advisor.
 * Auth: the advisor who owns the upload only.
 *
 * Always streams the bytes itself, with Content-Disposition: inline,
 * so a PDF or image can render in the side panel. A blob redirect
 * makes the browser download the file instead.
 * `?download=1` switches the disposition to attachment.
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
    let buf: Buffer | null = null;

    if (row.filename.startsWith("http")) {
      const upstream = await fetch(row.filename);
      if (!upstream.ok) {
        return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
      }
      buf = Buffer.from(await upstream.arrayBuffer());
    } else {
      buf = await getBlobBytes(row.filename);
    }
    if (!buf) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    const contentType = sniffContentType(row.original_name, row.mime_type, buf);
    const disposition = asDownload ? "attachment" : "inline";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
