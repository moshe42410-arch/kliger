import Link from "next/link";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  Users,
  Banknote,
  BellRing,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Pause,
  Sparkles,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { getActiveDashboardCards } from "@/lib/dashboard-cards";
import { AnimatedCounter } from "@/components/AnimatedCounter";

export const dynamic = "force-dynamic";

type CardColor =
  | "amber"
  | "purple"
  | "blue"
  | "green"
  | "rose"
  | "gold";

interface KpiCard {
  id: string;
  label: string;
  value: number;
  icon: typeof Users;
  color: CardColor;
  href: string;
  hint?: string;
}

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  const sql = getSql();
  const ownerId = user.id;
  const monthBucket = new Date().toISOString().slice(0, 7); // YYYY-MM

  const [
    clientsRow,
    depositsRow,
    waitingClientRow,
    waitingAdvisorRow,
    waitingAssociationRow,
    resolvedRow,
    carriedOverRow,
    snoozedRow,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int as c FROM clients WHERE owner_id = ${ownerId}`,
    sql`SELECT COUNT(*)::int as c FROM deposits WHERE owner_id = ${ownerId} AND active = 1`,
    sql`SELECT COUNT(*)::int as c FROM reminders WHERE owner_id = ${ownerId} AND status = 'waiting_client' AND month_bucket = ${monthBucket}`,
    sql`SELECT COUNT(*)::int as c FROM reminders WHERE owner_id = ${ownerId} AND status = 'waiting_advisor' AND month_bucket = ${monthBucket}`,
    sql`SELECT COUNT(*)::int as c FROM reminders WHERE owner_id = ${ownerId} AND status = 'waiting_association' AND month_bucket = ${monthBucket}`,
    sql`SELECT COUNT(*)::int as c FROM reminders WHERE owner_id = ${ownerId} AND status = 'resolved' AND month_bucket = ${monthBucket}`,
    sql`SELECT COUNT(*)::int as c FROM reminders WHERE owner_id = ${ownerId} AND status = 'carried_over'`,
    sql`SELECT COUNT(*)::int as c FROM reminders WHERE owner_id = ${ownerId} AND status = 'snoozed'`,
  ]);

  const getCount = (rows: unknown): number =>
    Number((rows as Array<{ c: number }>)[0]?.c ?? 0);
  const clientsCount = getCount(clientsRow);
  const depositsActive = getCount(depositsRow);
  const waitingClient = getCount(waitingClientRow);
  const waitingAdvisor = getCount(waitingAdvisorRow);
  const waitingAssociation = getCount(waitingAssociationRow);
  const resolvedThisMonth = getCount(resolvedRow);
  const carriedOver = getCount(carriedOverRow);
  const snoozed = getCount(snoozedRow);

  const allCards: Record<string, KpiCard> = {
    waiting_client: {
      id: "waiting_client",
      label: "ממתין ללקוח",
      value: waitingClient,
      icon: Clock,
      color: "amber",
      href: "/reminders?status=waiting_client",
      hint: "עדיין לא התקבלה תגובה",
    },
    waiting_advisor: {
      id: "waiting_advisor",
      label: "ממתין לטיפול יועץ",
      value: waitingAdvisor,
      icon: BellRing,
      color: "purple",
      href: "/reminders?status=waiting_advisor",
      hint: "דרוש טיפול שלך",
    },
    waiting_association: {
      id: "waiting_association",
      label: "ממתין לטיפול עמותה",
      value: waitingAssociation,
      icon: Building2,
      color: "blue",
      href: "/reminders?status=waiting_association",
      hint: "הועבר לעמותה",
    },
    snoozed: {
      id: "snoozed",
      label: "בהמתנה",
      value: snoozed,
      icon: Pause,
      color: "gold",
      href: "/reminders?status=snoozed",
      hint: "תזכורות שנדחו",
    },
    carried_over: {
      id: "carried_over",
      label: "מחודש קודם",
      value: carriedOver,
      icon: AlertCircle,
      color: "rose",
      href: "/reminders?status=carried_over",
      hint: "גלישה מחודשים קודמים",
    },
    resolved: {
      id: "resolved",
      label: "טופל החודש",
      value: resolvedThisMonth,
      icon: CheckCircle2,
      color: "green",
      href: "/reminders?status=resolved",
      hint: "הסתיים בהצלחה",
    },
    clients: {
      id: "clients",
      label: "לקוחות פעילים",
      value: clientsCount,
      icon: Users,
      color: "blue",
      href: "/clients",
    },
    deposits: {
      id: "deposits",
      label: "הפקדות פעילות",
      value: depositsActive,
      icon: Banknote,
      color: "green",
      href: "/deposits",
    },
  };

  const activeIds = getActiveDashboardCards(user.dashboardCards || null);
  const stats = activeIds.map((id) => allCards[id]).filter(Boolean) as KpiCard[];

  const totalPending =
    waitingClient + waitingAdvisor + waitingAssociation + carriedOver;
  const totalOpen = totalPending + snoozed;

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 6
      ? "לילה טוב"
      : hour < 12
        ? "בוקר טוב"
        : hour < 18
          ? "צהריים טובים"
          : "ערב טוב";
  const firstName = user.name?.split(" ")[0] || "";

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
        <div>
          <div className="text-fluid-sm text-navy-600 mb-3 flex items-center gap-2 font-medium">
            <Sparkles size={14} className="text-gold-500 animate-pulse-slow" />
            {greeting}
            {firstName ? `, ${firstName}` : ""} · {formatDateHe(now)}
          </div>
          <h1 className="section-title mb-3">לוח בקרה</h1>
          <p className="section-subtitle">
            סקירה חודשית · ניהול תזכורות והפקדות במקום אחד
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link href="/reminders" className="btn-primary">
            <BellRing size={18} /> כל התזכורות
          </Link>
          <Link href="/settings?tab=dashboard" className="btn-ghost">
            <Settings size={16} /> התאמה אישית
          </Link>
        </div>
      </div>

      {!user.gmailConnected && (
        <div className="mb-6 p-4 rounded-2xl border border-amber-300 bg-amber-50 flex items-start gap-3">
          <AlertCircle size={22} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-amber-900 mb-1">
              המערכת עדיין לא מחוברת לחשבון הגוגל שלך
            </div>
            <div className="text-sm text-amber-800">
              עד שתחבר את חשבון הגוגל שלך, מיילים לא יישלחו מהחשבון שלך.
            </div>
          </div>
          <Link href="/settings?tab=email" className="btn-primary">
            חבר עכשיו
          </Link>
        </div>
      )}

      {/* Highlight strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <HighlightCard
          title="פתוחים לטיפול"
          value={totalPending}
          description="סך התזכורות שמחייבות פעולה החודש"
          accent="amber"
          href="/reminders"
        />
        <HighlightCard
          title="סך פתוח"
          value={totalOpen}
          description="כולל ממתינים ובהמתנה"
          accent="gold"
          href="/reminders"
        />
        <HighlightCard
          title="טופלו החודש"
          value={resolvedThisMonth}
          description="תזכורות שהושלמו בחודש הנוכחי"
          accent="green"
          href="/reminders?status=resolved"
        />
      </div>

      {stats.length === 0 ? (
        <div className="card text-center py-14 relative overflow-hidden">
          <div className="blob blob-gold w-64 h-64 -top-20 -right-20" />
          <div className="relative">
            <div className="inline-flex p-4 rounded-2xl kpi-icon gold mb-4">
              <Settings size={28} />
            </div>
            <h3 className="text-fluid-xl font-heading font-bold text-navy-950 mb-2">
              לא נבחרו כרטיסים להצגה
            </h3>
            <p className="text-navy-700 mb-5">
              פתח את ההגדרות ובחר אילו מדדים להציג בלוח הבקרה
            </p>
            <Link href="/settings?tab=dashboard" className="btn-primary">
              <Settings size={18} /> פתיחת התאמה אישית
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.id}
                href={s.href}
                className="kpi-card group animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
              >
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="kpi-label">{s.label}</div>
                    <div className="kpi-value">
                      <AnimatedCounter value={s.value} />
                    </div>
                    {s.hint && (
                      <div className="text-xs text-navy-600 mt-2">
                        {s.hint}
                      </div>
                    )}
                  </div>
                  <div className={`kpi-icon ${s.color}`}>
                    <Icon size={22} />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs text-teal-600 font-semibold opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ease-out">
                  צפייה בפירוט <ArrowLeft size={12} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-10 card card-gold">
        <h2 className="text-xl font-heading font-bold text-navy-950 mb-4">
          פעולות מהירות
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/clients" className="btn-primary">
            <Users size={18} /> ניהול לקוחות
          </Link>
          <Link href="/deposits" className="btn-secondary">
            <Banknote size={18} /> ניהול הפקדות
          </Link>
          <Link href="/associations" className="btn-secondary">
            <Building2 size={18} /> עמותות
          </Link>
          <Link href="/reminders" className="btn-secondary">
            <BellRing size={18} /> תזכורות
          </Link>
        </div>
      </div>
    </div>
  );
}

function HighlightCard({
  title,
  value,
  description,
  accent,
  href,
}: {
  title: string;
  value: number;
  description: string;
  accent: "amber" | "gold" | "green";
  href: string;
}) {
  const accentStyles: Record<string, string> = {
    amber: "border-amber-400/40 hover:border-amber-500/60",
    gold: "border-gold-400/45 hover:border-gold-500/70",
    green: "border-teal-400/40 hover:border-teal-500/70",
  };
  const gradients: Record<string, string> = {
    amber:
      "linear-gradient(135deg, rgba(252,251,244,1) 0%, rgba(254,243,199,0.7) 100%)",
    gold:
      "linear-gradient(135deg, rgba(252,251,244,1) 0%, rgba(245,236,198,0.75) 100%)",
    green:
      "linear-gradient(135deg, rgba(252,251,244,1) 0%, rgba(211,245,238,0.7) 100%)",
  };
  const blobColor: Record<string, string> = {
    amber: "rgba(245,158,11,0.35)",
    gold: "rgba(212,175,55,0.4)",
    green: "rgba(54,153,137,0.32)",
  };
  const valueTint: Record<string, string> = {
    amber: "gradient-text-gold",
    gold: "gradient-text-gold",
    green: "gradient-text-teal",
  };
  return (
    <Link
      href={href}
      className={`relative overflow-hidden rounded-2xl p-5 border group ${accentStyles[accent]} transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_20px_45px_-12px_rgba(0,33,71,0.2)]`}
      style={{ background: gradients[accent] }}
    >
      <div
        className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition-opacity duration-500"
        style={{ background: blobColor[accent] }}
      />
      <div className="relative">
        <div className="text-sm text-navy-700 mb-1 font-semibold">{title}</div>
        <div
          className={`text-fluid-3xl font-black leading-none mb-2 font-heading ${valueTint[accent]}`}
        >
          <AnimatedCounter value={value} />
        </div>
        <div className="text-xs text-navy-600">{description}</div>
      </div>
    </Link>
  );
}

function formatDateHe(d: Date) {
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
