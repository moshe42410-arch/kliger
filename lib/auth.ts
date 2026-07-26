import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSql, getUserById, type User } from "./db";
import { generateSessionId } from "./auth-crypto";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "./auth-shared";

export { SESSION_COOKIE };

/**
 * יוצר סשן חדש למשתמש: רושם ל־DB, מציב cookie ב־HTTP response,
 * ומחזיר את מזהה הסשן.
 */
export async function createSession(userId: string): Promise<string> {
  const sql = getSql();
  const sid = generateSessionId();
  const expires = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  await sql`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${sid}, ${userId}, ${expires})
  `;

  cookies().set(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
  return sid;
}

export async function clearSession(): Promise<void> {
  const sql = getSql();
  const jar = cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing) {
    await sql`DELETE FROM sessions WHERE id = ${existing}`;
  }
  jar.delete(SESSION_COOKIE);
}

/**
 * שולף את המשתמש המחובר מ־cookie (אם קיים ותקף). לא זורק — מחזיר null.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const jar = cookies();
    const sid = jar.get(SESSION_COOKIE)?.value;
    if (!sid) return null;
    const sql = getSql();
    const rows = await sql`
      SELECT user_id, expires_at FROM sessions WHERE id = ${sid}
    `;
    const row = rows[0] as { user_id: string; expires_at: string } | undefined;
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await sql`DELETE FROM sessions WHERE id = ${sid}`;
      return null;
    }
    const user = await getUserById(row.user_id);
    if (!user || !user.active) return null;
    return user;
  } catch (err) {
    console.error("[auth] getCurrentUser error:", err);
    return null;
  }
}

/**
 * דורש משתמש מחובר. אם אין — זורק שגיאה שתהפוך ב־route handler ל־401.
 * לשימוש בתוך API routes.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("לא מחובר", 401);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AuthError("נדרשת הרשאת מנהל", 403);
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(msg: string, status = 401) {
    super(msg);
    this.status = status;
  }
}

/**
 * עוטף route handler — מטפל אוטומטית ב־AuthError.
 */
export async function withAuth<T>(
  fn: (user: User) => Promise<T> | T,
  opts: { requireAdmin?: boolean } = {}
): Promise<T | NextResponse> {
  try {
    const user = opts.requireAdmin ? await requireAdmin() : await requireUser();
    return await fn(user);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status }
      ) as unknown as T;
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 }) as unknown as T;
  }
}

/**
 * מחזיר את ה־owner_id (=user_id) של המשתמש המחובר. משמש בכל ה-writes.
 * זורק אם אין משתמש — לא לקרוא בקוד ציבורי (upload/api ציבוריים).
 */
export async function getCurrentOwnerId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("לא מחובר", 401);
  return user.id;
}

/**
 * בודק בעלות של תזכורת מסוימת ומחזיר את ה־owner_id (=user המחובר).
 * זורק אם המשתמש לא מחובר, או אם התזכורת שייכת ליועץ אחר.
 */
export async function assertReminderOwnership(
  reminderId: string
): Promise<{ ownerId: string }> {
  const ownerId = await getCurrentOwnerId();
  const sql = getSql();
  const rows = await sql`
    SELECT owner_id FROM reminders WHERE id = ${reminderId}
  `;
  const row = rows[0] as { owner_id: string } | undefined;
  if (!row) throw new AuthError("תזכורת לא נמצאה", 404);
  if (row.owner_id !== ownerId) {
    throw new AuthError("אין הרשאה", 403);
  }
  return { ownerId };
}
