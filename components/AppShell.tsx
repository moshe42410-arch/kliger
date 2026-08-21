"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, type SidebarCounts } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import type { User } from "@/lib/db";

export function AppShell({
  user,
  counts,
  isAdmin,
  children,
}: {
  user: User;
  counts: SidebarCounts;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  // סגירה אוטומטית במעבר דף (מובייל/טאבלט)
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // נעילת גלילה כשהתפריט פתוח
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  return (
    <div className="min-h-screen flex w-full">
      {/* Overlay — מתחת ל-lg בלבד */}
      <div
        className={`fixed inset-0 z-[45] bg-navy-950/45 backdrop-blur-[2px] transition-opacity lg:hidden ${
          navOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!navOpen}
        onClick={() => setNavOpen(false)}
      />

      <Sidebar
        counts={counts}
        isAdmin={isAdmin}
        mobileOpen={navOpen}
        onNavigate={() => setNavOpen(false)}
      />

      <div className="flex-1 min-w-0 w-full max-w-full flex flex-col">
        <TopBar user={user} onMenuClick={() => setNavOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 w-full max-w-full p-4 sm:p-6 lg:p-10 outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
