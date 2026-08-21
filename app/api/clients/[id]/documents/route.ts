import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSql, type ClientRow } from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";
import { putUpload } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type ClientDocumentDto = {
  id: string;
  originalName: string;
  mimeType: string | null;
  size: number | null;
  uploadedAt: string;
  source: "upload" | "drive";
  driveFileId: string | null;
  driveWebViewLink: string | null;
};

async function assertClientOwned(clientId: string, ownerId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT id FROM clients WHERE id = ${clientId} AND owner_id = ${ownerId}
  `;
  return Boolean((rows as ClientRow[])[0]);
}

function normalizeMime(file: File): string | undefined {
  const extMatch = file.name.match(/(\.[a-zA-Z0-9]{1,10})$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "";
  let contentType = file.type || undefined;
  if (!contentType || contentType === "application/octet-stream") {
    if (ext === ".pdf") contentType = "application/pdf";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".webp") contentType = "image/webp";
    else if (ext === ".xlsx")
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    else if (ext === ".xls") contentType = "application/vnd.ms-excel";
    else if (ext === ".doc") contentType = "application/msword";
    else if (ext === ".docx")
      contentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return contentType;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    if (!(await assertClientOwned(params.id, ownerId))) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }
    const sql = getSql();
    const rows = await sql`
      SELECT id, original_name, mime_type, size, uploaded_at,
             source, drive_file_id, drive_web_view_link
      FROM client_documents
      WHERE client_id = ${params.id} AND owner_id = ${ownerId}
      ORDER BY uploaded_at DESC
    `;
    const docs: ClientDocumentDto[] = (
      rows as Array<{
        id: string;
        original_name: string;
        mime_type: string | null;
        size: number | null;
        uploaded_at: string;
        source: string | null;
        drive_file_id: string | null;
        drive_web_view_link: string | null;
      }>
    ).map((r) => ({
      id: r.id,
      originalName: r.original_name,
      mimeType: r.mime_type,
      size: r.size,
      uploadedAt: r.uploaded_at,
      source: r.source === "drive" ? "drive" : "upload",
      driveFileId: r.drive_file_id,
      driveWebViewLink: r.drive_web_view_link,
    }));
    return NextResponse.json(docs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    if (!(await assertClientOwned(params.id, ownerId))) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    const single = form.get("file");
    if (single instanceof File) files.push(single);

    if (files.length === 0) {
      return NextResponse.json({ error: "לא נבחרו קבצים" }, { status: 400 });
    }
    if (files.length > 20) {
      return NextResponse.json(
        { error: "ניתן להעלות עד 20 קבצים בפעם אחת" },
        { status: 400 }
      );
    }

    const sql = getSql();
    const created: ClientDocumentDto[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `הקובץ ${file.name} גדול מדי (מעל 10MB)` },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const extMatch = file.name.match(/(\.[a-zA-Z0-9]{1,10})$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : "";
      const base =
        file.name
          .replace(/\.[a-zA-Z0-9]{1,10}$/, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "") || "file";
      const id = uuid();
      const storageName = `client_${params.id}_${id}__${base}${ext}`;
      const contentType = normalizeMime(file);
      const stored = await putUpload(storageName, buffer, contentType);

      await sql`
        INSERT INTO client_documents
          (id, owner_id, client_id, filename, original_name, mime_type, size, source)
        VALUES
          (${id}, ${ownerId}, ${params.id}, ${stored.key}, ${file.name}, ${contentType || file.type || null}, ${file.size}, ${"upload"})
      `;

      created.push({
        id,
        originalName: file.name,
        mimeType: contentType || file.type || null,
        size: file.size,
        uploadedAt: new Date().toISOString().slice(0, 19),
        source: "upload",
        driveFileId: null,
        driveWebViewLink: null,
      });
    }

    return NextResponse.json(created);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
