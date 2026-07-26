/**
 * KLIGER — Vercel Blob storage adapter (replaces filesystem uploads for prod).
 *
 * In prod (Vercel): stores in Vercel Blob. Returns public URLs.
 * In dev (local):   falls back to filesystem in ./uploads/ (matches old behavior).
 *
 * Switches based on `BLOB_READ_WRITE_TOKEN` env var — set automatically by Vercel
 * when you create a Blob store; absent locally.
 */

import fs from "node:fs";
import path from "node:path";

const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "uploads");
const LOCAL_LOGOS_DIR = path.join(process.cwd(), "uploads", "logos");

function useVercelBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function ensureLocalDirs() {
  if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_LOGOS_DIR)) {
    fs.mkdirSync(LOCAL_LOGOS_DIR, { recursive: true });
  }
}

export interface StoredFile {
  /** Storage key — either a full public URL (blob) or just a filename (local). */
  key: string;
  /** Public URL you can put in <img src> or as an email attachment path. */
  url: string;
  size: number;
  contentType?: string;
}

/**
 * Upload a client-uploaded document (from /upload/[token] form).
 * Returns a StoredFile you should persist in the `uploads.filename` column.
 */
export async function putUpload(
  filename: string,
  buffer: Buffer,
  contentType?: string
): Promise<StoredFile> {
  if (useVercelBlob()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${filename}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return {
      key: blob.url, // in prod, we store the full URL
      url: blob.url,
      size: buffer.length,
      contentType,
    };
  }

  ensureLocalDirs();
  const fullPath = path.join(LOCAL_UPLOADS_DIR, filename);
  await fs.promises.writeFile(fullPath, buffer);
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  return {
    key: filename,
    url: `${baseUrl}/api/uploads/${encodeURIComponent(filename)}`,
    size: buffer.length,
    contentType,
  };
}

/**
 * Upload a user's company logo.
 */
export async function putLogo(
  filename: string,
  buffer: Buffer,
  contentType?: string
): Promise<StoredFile> {
  if (useVercelBlob()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`logos/${filename}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return {
      key: blob.url,
      url: blob.url,
      size: buffer.length,
      contentType,
    };
  }

  ensureLocalDirs();
  const fullPath = path.join(LOCAL_LOGOS_DIR, filename);
  await fs.promises.writeFile(fullPath, buffer);
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  return {
    key: filename,
    url: `${baseUrl}/api/users/logo/${encodeURIComponent(filename)}`,
    size: buffer.length,
    contentType,
  };
}

/**
 * Delete a previously uploaded file (from either upload or logo).
 * `key` is the value returned by putUpload/putLogo (full URL in prod, filename in dev).
 */
export async function deleteBlob(key: string): Promise<void> {
  if (key.startsWith("http")) {
    // Vercel Blob URL
    try {
      const { del } = await import("@vercel/blob");
      await del(key);
    } catch (err) {
      console.warn("[blob] delete failed:", err);
    }
    return;
  }

  // Local file
  const tryPaths = [
    path.join(LOCAL_UPLOADS_DIR, key),
    path.join(LOCAL_LOGOS_DIR, key),
  ];
  for (const p of tryPaths) {
    if (fs.existsSync(p)) {
      try {
        await fs.promises.unlink(p);
      } catch (err) {
        console.warn("[blob] local delete failed:", err);
      }
    }
  }
}

/**
 * Fetch a file's bytes — used when we need to attach it to an outgoing email.
 * Works with both Vercel Blob (fetches HTTP) and local files.
 */
export async function getBlobBytes(key: string): Promise<Buffer | null> {
  if (key.startsWith("http")) {
    try {
      const res = await fetch(key);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      return Buffer.from(arr);
    } catch {
      return null;
    }
  }

  // Local
  const tryPaths = [
    path.join(LOCAL_UPLOADS_DIR, key),
    path.join(LOCAL_LOGOS_DIR, key),
  ];
  for (const p of tryPaths) {
    if (fs.existsSync(p)) {
      try {
        return await fs.promises.readFile(p);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Returns a public URL for a stored key — same logic as putUpload/putLogo, without upload.
 * Useful when the DB has a `filename` string and we need to render it as <img>.
 */
export function urlForKey(
  key: string | null | undefined,
  kind: "upload" | "logo" = "upload"
): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key; // already a full URL (prod Blob)
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  if (kind === "logo") {
    return `${baseUrl}/api/users/logo/${encodeURIComponent(key)}`;
  }
  return `${baseUrl}/api/uploads/${encodeURIComponent(key)}`;
}
