import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";
import { deleteBlob, getBlobBytes } from "@/lib/blob-storage";
import {
  downloadDriveFileBytes,
  getDriveAccessToken,
} from "@/lib/google-drive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const rows = await sql`
      SELECT filename, original_name, mime_type, source, drive_file_id
      FROM client_documents
      WHERE id = ${params.docId}
        AND client_id = ${params.id}
        AND owner_id = ${ownerId}
    `;
    const row = (
      rows as Array<{
        filename: string;
        original_name: string;
        mime_type: string | null;
        source: string | null;
        drive_file_id: string | null;
      }>
    )[0];
    if (!row) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    let bytes: Buffer | null = null;
    let contentType = row.mime_type || "application/octet-stream";
    let filename = row.original_name;

    if (row.source === "drive" && row.drive_file_id) {
      const token = await getDriveAccessToken(ownerId);
      const downloaded = await downloadDriveFileBytes(token, {
        id: row.drive_file_id,
        name: row.original_name,
        mimeType: row.mime_type || "application/octet-stream",
      });
      bytes = downloaded.buffer;
      contentType = downloaded.contentType;
      filename = downloaded.filename;
    } else {
      bytes = await getBlobBytes(row.filename);
    }

    if (!bytes) {
      return NextResponse.json({ error: "קובץ לא נמצא באחסון" }, { status: 404 });
    }

    const download = req.nextUrl.searchParams.get("download") === "1";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    headers.set("Cache-Control", "private, max-age=60");

    return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const rows = await sql`
      SELECT filename, source
      FROM client_documents
      WHERE id = ${params.docId}
        AND client_id = ${params.id}
        AND owner_id = ${ownerId}
    `;
    const row = (rows as Array<{ filename: string; source: string | null }>)[0];
    if (!row) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    await sql`
      DELETE FROM client_documents
      WHERE id = ${params.docId} AND owner_id = ${ownerId}
    `;

    // Drive files stay in Drive — only unlink from the app.
    // Uploaded files: remove from blob storage.
    if (row.source !== "drive") {
      try {
        await deleteBlob(row.filename);
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
