/**
 * Helpers for Google Drive folder URLs linked to clients.
 * Full Drive API listing/email sync is separate (OAuth).
 */

/** Extract folder id from common Drive share / open URLs. */
export function extractDriveFolderId(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{20,})$/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Normalize pasted link; keep full URL when possible. */
export function normalizeDriveFolderUrl(input: string): {
  url: string | null;
  folderId: string | null;
} {
  const trimmed = input.trim();
  if (!trimmed) return { url: null, folderId: null };
  const folderId = extractDriveFolderId(trimmed);
  if (!folderId) {
    return { url: trimmed, folderId: null };
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return { url: trimmed, folderId };
  }
  return {
    url: `https://drive.google.com/drive/folders/${folderId}`,
    folderId,
  };
}
