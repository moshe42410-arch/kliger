import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-shared";

/**
 * מסלולים פומביים שלא מצריכים משתמש מחובר:
 * - /login, /api/auth/* (התחברות)
 * - /upload/... — קישור להעלאת אסמכתא של לקוח
 * - /api/upload/... — endpoint העלאה שהלקוח משתמש בו
 * - /api/users/[id]/logo/image — הצגת לוגו בעמוד ההעלאה
 * - נכסים סטטיים (מטופלים דרך matcher)
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/",
  "/upload/",
  "/api/upload/",
  // Note: לוגו לציבור נגיש דרך /api/users/[id]/logo/image
  "/api/users/",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  for (const p of PUBLIC_PREFIXES) {
    if (pathname.startsWith(p)) {
      // רק endpoint הלוגו של המשתמשים פתוח לציבור, לא כל /api/users/*
      if (p === "/api/users/") {
        return pathname.endsWith("/logo/image");
      }
      return true;
    }
  }
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname + (search || ""));
    if (pathname !== "/") url.searchParams.set("notice", "session_expired");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * matcher — מריץ את המידלוור על כל בקשה, פרט לנכסי next הפנימיים,
   * favicon, נכסים סטטיים בציבור וכו'.
   */
  matcher: [
    "/((?!_next/|favicon\\.ico|kliger-logo\\.png|robots\\.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|woff|woff2|ttf)$).*)",
  ],
};
