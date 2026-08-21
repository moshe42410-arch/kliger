import { v4 as uuid } from "uuid";
import { getSql, type ClientRow } from "@/lib/db";
import {
  getDriveAccessToken,
  listDriveFolderFiles,
} from "@/lib/google-drive";
import { extractDriveFolderId } from "@/lib/drive-folder";

export type SyncDriveResult = {
  ok: boolean;
  added: number;
  updated: number;
  removed: number;
  total: number;
  error?: string;
};

/**
 * Sync files from the client's linked Drive folder into client_documents.
 */
export async function syncClientDriveFolder(
  ownerId: string,
  clientId: string
): Promise<SyncDriveResult> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM clients WHERE id = ${clientId} AND owner_id = ${ownerId}
  `;
  const client = (rows as ClientRow[])[0];
  if (!client) return { ok: false, added: 0, updated: 0, removed: 0, total: 0, error: "לקוח לא נמצא" };

  const folderId =
    client.drive_folder_id ||
    (client.drive_folder_url
      ? extractDriveFolderId(client.drive_folder_url)
      : null);

  if (!folderId) {
    return {
      ok: false,
      added: 0,
      updated: 0,
      removed: 0,
      total: 0,
      error: "לא חוברה תיקיית Drive ללקוח",
    };
  }

  // Persist extracted id if missing
  if (!client.drive_folder_id) {
    await sql`
      UPDATE clients SET drive_folder_id = ${folderId} WHERE id = ${clientId}
    `;
  }

  let accessToken: string;
  try {
    accessToken = await getDriveAccessToken(ownerId);
  } catch (e) {
    return {
      ok: false,
      added: 0,
      updated: 0,
      removed: 0,
      total: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  let driveFiles;
  try {
    driveFiles = await listDriveFolderFiles(accessToken, folderId);
  } catch (e) {
    return {
      ok: false,
      added: 0,
      updated: 0,
      removed: 0,
      total: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const existing = await sql`
    SELECT id, drive_file_id, original_name, mime_type, size, drive_web_view_link
    FROM client_documents
    WHERE client_id = ${clientId}
      AND owner_id = ${ownerId}
      AND source = 'drive'
  `;
  const byDriveId = new Map(
    (
      existing as Array<{
        id: string;
        drive_file_id: string | null;
        original_name: string;
        mime_type: string | null;
        size: number | null;
        drive_web_view_link: string | null;
      }>
    )
      .filter((r) => r.drive_file_id)
      .map((r) => [r.drive_file_id as string, r])
  );

  let added = 0;
  let updated = 0;
  const seen = new Set<string>();

  for (const f of driveFiles) {
    seen.add(f.id);
    const prev = byDriveId.get(f.id);
    const uploadedAt = (f.modifiedTime || new Date().toISOString()).slice(0, 19);
    if (!prev) {
      const id = uuid();
      await sql`
        INSERT INTO client_documents
          (id, owner_id, client_id, filename, original_name, mime_type, size, uploaded_at, source, drive_file_id, drive_web_view_link)
        VALUES
          (${id}, ${ownerId}, ${clientId}, ${"drive:" + f.id}, ${f.name}, ${f.mimeType}, ${f.size}, ${uploadedAt}, ${"drive"}, ${f.id}, ${f.webViewLink})
      `;
      added++;
    } else {
      const changed =
        prev.original_name !== f.name ||
        prev.mime_type !== f.mimeType ||
        (prev.size || null) !== (f.size || null) ||
        (prev.drive_web_view_link || null) !== (f.webViewLink || null);
      if (changed) {
        await sql`
          UPDATE client_documents
          SET original_name = ${f.name},
              mime_type = ${f.mimeType},
              size = ${f.size},
              drive_web_view_link = ${f.webViewLink},
              uploaded_at = ${uploadedAt}
          WHERE id = ${prev.id}
        `;
        updated++;
      }
    }
  }

  let removed = 0;
  for (const [driveId, row] of byDriveId) {
    if (!seen.has(driveId)) {
      await sql`DELETE FROM client_documents WHERE id = ${row.id}`;
      removed++;
    }
  }

  return {
    ok: true,
    added,
    updated,
    removed,
    total: driveFiles.length,
  };
}

/** Sync all clients that have a Drive folder linked (for cron). */
export async function syncAllDriveFolders(): Promise<{
  clients: number;
  results: Array<{ clientId: string; result: SyncDriveResult }>;
}> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, owner_id FROM clients
    WHERE drive_folder_url IS NOT NULL OR drive_folder_id IS NOT NULL
  `;
  const results: Array<{ clientId: string; result: SyncDriveResult }> = [];
  for (const r of rows as Array<{ id: string; owner_id: string }>) {
    const result = await syncClientDriveFolder(r.owner_id, r.id);
    results.push({ clientId: r.id, result });
  }
  return { clients: results.length, results };
}
