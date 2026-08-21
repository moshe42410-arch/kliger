import { getSql } from "./db";
import {
  explainGoogleTokenError,
  getGoogleOAuthClient,
} from "./google-credentials";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveListedFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string | null;
  webViewLink: string | null;
};

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const creds = getGoogleOAuthClient();
  if (!creds) {
    throw new Error("GOOGLE_CLIENT_ID / SECRET לא מוגדרים");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(explainGoogleTokenError(text));
  }
  const json = JSON.parse(text) as { access_token?: string };
  if (!json.access_token) throw new Error("Google לא החזיר access_token");
  return json.access_token;
}

export async function getDriveAccessToken(userId: string): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    SELECT gmail_refresh_token FROM users WHERE id = ${userId}
  `;
  const refresh = (rows[0] as { gmail_refresh_token: string | null } | undefined)
    ?.gmail_refresh_token;
  if (!refresh) {
    throw new Error(
      "אין חיבור Google. בהגדרות → חברו מחדש את Google (כולל הרשאת Drive)."
    );
  }
  if (!getGoogleOAuthClient()) {
    throw new Error("GOOGLE_CLIENT_ID / SECRET לא מוגדרים");
  }
  return refreshAccessToken(refresh);
}

async function listChildren(
  accessToken: string,
  folderId: string
): Promise<DriveListedFile[]> {
  const out: DriveListedFile[] = [];
  let pageToken: string | undefined;
  do {
    const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`;
    const params = new URLSearchParams({
      q,
      pageSize: "100",
      fields:
        "nextPageToken, files(id,name,mimeType,size,modifiedTime,webViewLink)",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${DRIVE_FILES}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const text = await res.text();
    if (!res.ok) {
      if (
        text.includes("accessNotConfigured") ||
        text.includes("has not been used in project") ||
        text.includes("it is disabled")
      ) {
        throw new Error(
          "Google Drive API לא מופעל בפרויקט Google Cloud. " +
            "Console → APIs & Services → Library → חפשו Google Drive API → Enable. " +
            "אחרי הפעלה המתינו דקה–שתיים ונסו שוב."
        );
      }
      if (text.includes("insufficientPermissions") || res.status === 403) {
        throw new Error(
          "חסרה הרשאת Drive. בהגדרות → נתקו Google וחברו מחדש (יינתן אישור לקריאת דרייב)."
        );
      }
      throw new Error(`Drive list failed: ${text.slice(0, 240)}`);
    }
    const json = JSON.parse(text) as {
      nextPageToken?: string;
      files?: Array<{
        id: string;
        name: string;
        mimeType: string;
        size?: string;
        modifiedTime?: string;
        webViewLink?: string;
      }>;
    };
    for (const f of json.files || []) {
      out.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size != null ? Number(f.size) : null,
        modifiedTime: f.modifiedTime || null,
        webViewLink: f.webViewLink || null,
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);
  return out;
}

/** Recursively list files under a folder (skips folder rows in result). */
export async function listDriveFolderFiles(
  accessToken: string,
  folderId: string,
  opts?: { maxDepth?: number; maxFiles?: number }
): Promise<DriveListedFile[]> {
  const maxDepth = opts?.maxDepth ?? 4;
  const maxFiles = opts?.maxFiles ?? 400;
  const files: DriveListedFile[] = [];

  async function walk(id: string, depth: number) {
    if (files.length >= maxFiles) return;
    const children = await listChildren(accessToken, id);
    for (const child of children) {
      if (files.length >= maxFiles) break;
      if (child.mimeType === FOLDER_MIME) {
        if (depth < maxDepth) await walk(child.id, depth + 1);
      } else {
        files.push(child);
      }
    }
  }

  await walk(folderId, 0);
  return files;
}

function isGoogleNative(mime: string): boolean {
  return mime.startsWith("application/vnd.google-apps.");
}

/** Download bytes for a Drive file (exports Docs/Sheets when needed). */
export async function downloadDriveFileBytes(
  accessToken: string,
  file: { id: string; name: string; mimeType: string }
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  if (isGoogleNative(file.mimeType) && file.mimeType !== FOLDER_MIME) {
    let exportMime = "application/pdf";
    let ext = ".pdf";
    if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
      exportMime =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      ext = ".xlsx";
    } else if (file.mimeType === "application/vnd.google-apps.document") {
      exportMime = "application/pdf";
      ext = ".pdf";
    } else if (
      file.mimeType === "application/vnd.google-apps.presentation"
    ) {
      exportMime = "application/pdf";
      ext = ".pdf";
    }
    const res = await fetch(
      `${DRIVE_FILES}/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportMime)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`ייצוא מקובץ Drive נכשל: ${t.slice(0, 200)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const base = file.name.replace(/\.[^.]+$/, "");
    return {
      buffer: buf,
      filename: base.endsWith(ext) ? base : `${base}${ext}`,
      contentType: exportMime,
    };
  }

  const res = await fetch(
    `${DRIVE_FILES}/${encodeURIComponent(file.id)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`הורדת קובץ Drive נכשלה: ${t.slice(0, 200)}`);
  }
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    filename: file.name,
    contentType: file.mimeType || "application/octet-stream",
  };
}
