"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Banknote,
  BellRing,
  LayoutDashboard,
  Mail,
  Building2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface SidebarCounts {
  waitingAdvisor: number;
  carriedOver: number;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  getBadge?: (counts: SidebarCounts) => number;
  badgeTone?: "red" | "gold";
}

const mainNav: NavItem[] = [
  { href: "/", label: "לוח בקרה", icon: LayoutDashboard },
  { href: "/clients", label: "לקוחות", icon: Users },
  { href: "/deposits", label: "הפקדות", icon: Banknote },
  { href: "/associations", label: "עמותות", icon: Building2 },
  {
    href: "/reminders",
    label: "תזכורות",
    icon: BellRing,
    getBadge: (c) => c.waitingAdvisor + c.carriedOver,
    badgeTone: "red",
  },
];

export function Sidebar({
  counts,
  isAdmin,
}: {
  counts: SidebarCounts;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  if (
    pathname?.startsWith("/upload/") ||
    pathname === "/login" ||
    pathname === "/change-password"
  )
    return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className="w-72 shrink-0 min-h-screen p-6 flex flex-col relative text-white/90"
      style={{
        background:
          "linear-gradient(180deg, #050e22 0%, #0a1830 55%, #030815 100%)",
        boxShadow:
          "inset -1px 0 0 rgba(217,168,37,0.12), inset 0 0 120px rgba(217,168,37,0.03)",
      }}
      aria-label="ניווט ראשי"
    >
      {/* subtle top gold shimmer */}
      <div
        aria-hidden
        className="absolute top-0 right-0 left-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(217,168,37,0.5), transparent)",
        }}
      />

      {/* Brand block */}
      <Link
        href="/"
        className="block mb-10 group focus:outline-none"
        aria-label="דף הבית - KLIGER"
      >
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kliger-mark.svg"
            alt=""
            className="w-14 h-14 shrink-0 transition-transform duration-500 group-hover:scale-105"
          />
          <div className="min-w-0">
            <div
              className="text-2xl font-brand tracking-[0.35em] text-transparent bg-clip-text"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #f4d47c 0%, #d9a825 55%, #a67912 100%)",
              }}
            >
              KLIGER
            </div>
            <div className="text-[9.5px] tracking-[0.35em] text-gold-500/60 mt-0.5 font-medium">
              FINANCIAL · ADVISORY
            </div>
          </div>
        </div>
        <div
          aria-hidden
          className="mt-5 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(217,168,37,0.35), transparent)",
          }}
        />
      </Link>

      {/* Section label */}
      <div className="text-[10px] tracking-[0.3em] font-semibold text-white/35 mb-3 px-1">
        ניווט
      </div>

      <nav className="flex flex-col gap-1" aria-label="תפריט ראשי">
        {mainNav.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const badge = item.getBadge?.(counts) ?? 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`
                relative flex items-center gap-3 px-4 py-3 rounded-lg text-[15px]
                transition-all duration-300 ease-out group
                ${
                  active
                    ? "bg-gold-500/[0.09] text-gold-200 border border-gold-500/25"
                    : "text-white/75 hover:bg-white/[0.04] border border-transparent hover:text-white hover:border-white/10"
                }
              `}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-l-full bg-gold-400"
                />
              )}

              <Icon
                size={18}
                strokeWidth={1.75}
                className={`
                  transition-all duration-300 shrink-0
                  ${
                    active
                      ? "text-gold-300"
                      : "text-white/60 group-hover:text-gold-300"
                  }
                `}
              />
              <span className={`flex-1 ${active ? "font-medium" : ""}`}>
                {item.label}
              </span>

              {badge > 0 && (
                <span
                  className={
                    active
                      ? "min-w-5 h-5 px-1.5 rounded-full text-[10.5px] font-bold flex items-center justify-center bg-gold-500 text-navy-950"
                      : "min-w-5 h-5 px-1.5 rounded-full text-[10.5px] font-bold flex items-center justify-center bg-red-500/90 text-white shadow-[0_0_10px_rgba(239,68,68,0.35)]"
                  }
                  aria-label={`${badge} פריטים ממתינים`}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        {isAdmin && (
          <>
            <div className="text-[10px] tracking-[0.3em] font-semibold text-white/35 mb-2 px-1 mt-6">
              ניהול
            </div>
            <Link
              href="/admin/users"
              aria-current={isActive("/admin/users") ? "page" : undefined}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg text-[15px]
                transition-all duration-300 ease-out group
                ${
                  isActive("/admin/users")
                    ? "bg-gold-500/[0.09] text-gold-200 border border-gold-500/25"
                    : "text-white/75 hover:bg-white/[0.04] border border-transparent hover:text-white hover:border-white/10"
                }
              `}
            >
              <ShieldCheck
                size={18}
                strokeWidth={1.75}
                className={`transition-all duration-300 shrink-0 ${
                  isActive("/admin/users")
                    ? "text-gold-300"
                    : "text-white/60 group-hover:text-gold-300"
                }`}
              />
              <span>ניהול יועצים</span>
            </Link>
          </>
        )}

        <Link
          href="/contact"
          aria-current={isActive("/contact") ? "page" : undefined}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg text-[15px]
            transition-all duration-300 ease-out group
            ${
              isActive("/contact")
                ? "bg-gold-500/[0.09] text-gold-200 border border-gold-500/25"
                : "text-white/75 hover:bg-white/[0.04] border border-transparent hover:text-white hover:border-white/10"
            }
          `}
        >
          <Mail
            size={18}
            strokeWidth={1.75}
            className={`transition-all duration-300 shrink-0 ${
              isActive("/contact")
                ? "text-gold-300"
                : "text-white/60 group-hover:text-gold-300"
            }`}
          />
          <span>צור קשר</span>
        </Link>

        <div
          aria-hidden
          className="h-px mt-4"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(217,168,37,0.25), transparent)",
          }}
        />
        <div className="pt-3 text-center">
          <div
            className="font-brand text-sm tracking-[0.35em] text-transparent bg-clip-text mb-1"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #f4d47c, #d9a825, #a67912)",
            }}
          >
            KLIGER
          </div>
          <div className="text-[10px] text-white/40 tracking-widest">
            עובדים חכם · עובדים נכון
          </div>
        </div>
      </div>
    </aside>
  );
}
