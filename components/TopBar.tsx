"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Settings,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  Sparkles,
  Users,
  Mail,
  KeyRound,
  ShieldCheck,
  MessageSquareQuote,
} from "lucide-react";
import type { User } from "@/lib/db";

export function TopBar({ user }: { user: User | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (
    pathname?.startsWith("/upload/") ||
    pathname === "/login" ||
    pathname === "/change-password"
  )
    return null;

  const initials = (user?.name || "K")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const title = pageTitle(pathname);
  const logoSrc =
    user?.logoFilename
      ? `/api/users/${user.id}/logo/image?v=${encodeURIComponent(user.logoFilename)}`
      : null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login?notice=logged_out");
    router.refresh();
  }

  return (
    <div className="topbar">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center bg-gradient-to-br from-cream-100 to-white border border-gold-400/40">
          <LayoutDashboard size={18} className="text-navy-950/80" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-gold-700 leading-none mb-1.5 font-medium tracking-[0.28em] uppercase">
            Financial · Advisory
          </div>
          <div className="text-lg text-navy-950 truncate font-heading tracking-wide">
            {title}
          </div>
        </div>
      </div>

      <div ref={rootRef} className="relative">
        <button
          className="avatar-btn"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          <ChevronDown
            size={16}
            className={`transition-transform ${open ? "rotate-180" : ""} text-navy-500`}
          />
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-semibold text-navy-950">
              {user?.name || "משתמש"}
            </span>
            {user?.companyName && (
              <span className="text-[11px] text-navy-600 truncate max-w-[160px]">
                {user.companyName}
              </span>
            )}
          </div>
          <div className="avatar-circle">
            {logoSrc ? (
              <img src={logoSrc} alt={user?.name || "avatar"} />
            ) : (
              <span>{initials}</span>
            )}
          </div>
        </button>

        {open && (
          <div className="dropdown-menu" style={{ left: 0, right: "auto" }}>
            <div className="px-4 pt-2 pb-3 border-b border-navy-950/8 mb-2">
              <div className="flex items-center gap-3">
                <div
                  className="avatar-circle"
                  style={{ width: 44, height: 44 }}
                >
                  {logoSrc ? (
                    <img src={logoSrc} alt={user?.name || "avatar"} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-navy-950 truncate flex items-center gap-1.5">
                    {user?.name || "לא מחובר"}
                    {user?.role === "admin" && (
                      <ShieldCheck size={13} className="text-gold-500" />
                    )}
                  </div>
                  <div className="text-[11px] text-navy-600 truncate" dir="ltr">
                    {user?.email || "—"}
                  </div>
                </div>
              </div>
            </div>

            <Link
              href="/settings"
              className="dropdown-item"
              onClick={() => setOpen(false)}
            >
              <Settings size={16} /> פרופיל והגדרות
            </Link>
            <Link
              href="/settings?tab=email"
              className="dropdown-item"
              onClick={() => setOpen(false)}
            >
              <Mail size={16} /> חיבור למייל שלי
            </Link>
            <Link
              href="/settings?tab=templates"
              className="dropdown-item"
              onClick={() => setOpen(false)}
            >
              <MessageSquareQuote size={16} /> ניסוח מיילים
            </Link>
            <Link
              href="/settings?tab=dashboard"
              className="dropdown-item"
              onClick={() => setOpen(false)}
            >
              <Sparkles size={16} /> התאמת מסך ראשי
            </Link>
            <Link
              href="/change-password"
              className="dropdown-item"
              onClick={() => setOpen(false)}
            >
              <KeyRound size={16} /> שינוי סיסמה
            </Link>

            {user?.role === "admin" && (
              <>
                <div className="my-2 border-t border-navy-950/8" />
                <Link
                  href="/admin/users"
                  className="dropdown-item"
                  onClick={() => setOpen(false)}
                >
                  <Users size={16} /> ניהול יועצים
                </Link>
              </>
            )}

            <div className="mt-2 pt-2 border-t border-navy-950/8">
              <button
                className="dropdown-item danger"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                type="button"
              >
                <LogOut size={16} /> התנתקות
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function pageTitle(pathname: string | null) {
  if (!pathname || pathname === "/") return "לוח בקרה";
  if (pathname.startsWith("/clients")) return "לקוחות";
  if (pathname.startsWith("/deposits")) return "הפקדות";
  if (pathname.startsWith("/associations")) return "עמותות";
  if (pathname.startsWith("/reminders")) return "תזכורות";
  if (pathname.startsWith("/contact")) return "צור קשר";
  if (pathname.startsWith("/admin/users")) return "ניהול יועצים";
  if (pathname.startsWith("/change-password")) return "שינוי סיסמה";
  if (pathname.startsWith("/settings")) return "הגדרות";
  return "KLIGER";
}
