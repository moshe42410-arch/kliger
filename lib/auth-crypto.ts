import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing עם scrypt מובנה של Node — ללא תלויות חיצוניות
 * (בלי bcrypt, בלי argon2). ה-hash מקודד בפורמט:
 *   scrypt$N$r$p$salt_base64$hash_base64
 * כדי שנוכל לזהות את האלגוריתם ולהגדיל פרמטרים בעתיד.
 */

const N = 16384; // CPU/memory cost
const r = 8;
const p = 1;
const KEY_LEN = 64;

export function hashPassword(plain: string): string {
  if (!plain || plain.length < 4) {
    throw new Error("סיסמה חייבת להכיל לפחות 4 תווים");
  }
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEY_LEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored || !stored.startsWith("scrypt$")) return false;
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const NN = Number(nStr);
  const rr = Number(rStr);
  const pp = Number(pStr);
  if (!NN || !rr || !pp) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(plain, salt, expected.length, { N: NN, r: rr, p: pp });
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/**
 * מייצר סיסמה זמנית בת 10 תווים — קלה־יחסית לזכור/להעתיק, ובכל זאת רנדומלית.
 * (משתמש מתבקש להחליף אותה בכניסה הראשונה.)
 */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
  const buf = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}
