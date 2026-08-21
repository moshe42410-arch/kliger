import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import type { SidebarCounts } from "@/components/Sidebar";
import { getSql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Scheduler runs via Vercel Cron (/api/cron/reminders), not in-process.

export const metadata: Metadata = {
  title: "KLIGER - עובדים חכם עובדים נכון",
  description: "מערכת ניהול העברות והפקדות",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  let counts: SidebarCounts = { waitingAdvisor: 0, carriedOver: 0 };
  if (user) {
    try {
      const sql = getSql();
      const [waitingRow, carriedRow] = await Promise.all([
        sql`SELECT COUNT(*)::int as c FROM reminders WHERE owner_id = ${user.id} AND action_done_at IS NULL AND status NOT IN ('resolved','snoozed','waiting_association')`,
        sql`SELECT COUNT(*)::int as c FROM reminders WHERE owner_id = ${user.id} AND status = 'carried_over'`,
      ]);
      const waitingAdvisor = Number(
        (waitingRow[0] as { c: number } | undefined)?.c ?? 0
      );
      const carriedOver = Number(
        (carriedRow[0] as { c: number } | undefined)?.c ?? 0
      );
      counts = { waitingAdvisor, carriedOver };
    } catch (err) {
      console.error("[layout] counts error:", err);
      counts = { waitingAdvisor: 0, carriedOver: 0 };
    }
  }

  const showChrome = !!user;
  const isAdmin = user?.role === "admin";

  return (
    <html lang="he" dir="rtl">
      <body>
        <a href="#main-content" className="skip-link">
          דלג לתוכן הראשי
        </a>
        {showChrome ? (
          <AppShell user={user} counts={counts} isAdmin={isAdmin}>
            {children}
          </AppShell>
        ) : (
          <main id="main-content" tabIndex={-1} className="min-h-screen">
            {children}
          </main>
        )}
      </body>
    </html>
  );
}
