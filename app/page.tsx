import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getSql,
  parseDeposit,
  parseReminder,
  monthBucketOf,
  type DepositRow,
  type ReminderRow,
  type Reminder,
  type Deposit,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ensureRemindersForDeposit } from "@/lib/reminders";
import {
  depositDocBucket,
  isDepositDocComplete,
} from "@/lib/deposit-doc-buckets";
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
  const nowIso = new Date().toISOString();
  const currentBucket = monthBucketOf(new Date());

  const [
    clientsRow,
    depositRows,
    waitingAssociationRow,
    carriedOverRow,
    snoozedRow,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int as c FROM clients WHERE owner_id = ${ownerId}`,
    sql`SELECT * FROM deposits WHERE owner_id = ${ownerId} ORDER BY created_at DESC`,
    sql`SELECT COUNT(*)::int as c FROM reminders WHERE owner_id = ${ownerId} AND status = 'waiting_association' AND month_bucket = ${currentBucket} AND scheduled_for <= ${nowIso}`,
    sql`SELECT COUNT(*)::int as c FROM reminders WHERE owner_id = ${ownerId} AND status = 'carried_over'`,
    sql`SELECT COUNT(*)::int as c FROM reminders WHERE owner_id = ${ownerId} AND status = 'snoozed'`,
  ]);

  const getCount = (rows: unknown): number =>
    Number((rows as Array<{ c: number }>)[0]?.c ?? 0);

  const deposits = (depositRows as DepositRow[]).map(parseDeposit);
  for (const d of deposits) {
    if (d.active) {
      try {
        await ensureRemindersForDeposit(d);
      } catch {
        /* ignore */
      }
    }
  }

  const dueRemRows = await sql`
    SELECT * FROM reminders
    WHERE owner_id = ${ownerId}
      AND phase = 'primary'
      AND (
        scheduled_for <= ${nowIso}
        OR month_bucket = ${currentBucket}
      )
    ORDER BY target_date DESC
  `;

  const depositById = Object.fromEntries(deposits.map((d) => [d.id, d]));
  const monthByDeposit: Record<string, Reminder> = {};
  for (const row of dueRemRows as ReminderRow[]) {
    const r = parseReminder(row);
    const dep = depositById[r.depositId];
    if (!dep) continue;
    const existing = monthByDeposit[r.depositId];
    if (!existing) {
      monthByDeposit[r.depositId] = r;
      continue;
    }
    const existingDone = isDepositDocComplete(dep.depositType, existing);
    const incomingDone = isDepositDocComplete(dep.depositType, r);
    if (existingDone && !incomingDone) {
      monthByDeposit[r.depositId] = r;
    }
  }

  const tabCounts = { pending: 0, done: 0, paid: 0, archive: 0 };
  let activeDeposits = 0;
  for (const d of deposits) {
    if (d.active) activeDeposits++;
    const bucket = depositDocBucket(d.depositType, monthByDeposit[d.id]);
    tabCounts[bucket]++;
  }

  const clientsCount = getCount(clientsRow);
  const waitingAssociation = getCount(waitingAssociationRow);
  const carriedOver = getCount(carriedOverRow);
  const snoozed = getCount(snoozedRow);

  const neitherCount = tabCounts.pending;
  const doneUnpaidCount = tabCounts.done;
  const paidUndoneCount = tabCounts.paid;
  const fullyDoneCount = tabCounts.archive;

  // פירוט לפי סוג (מתוך אותן הפקדות)
  let salaryDoneUnpaid = 0;
  let salaryPaidUndone = 0;
  let scholarshipDoneUnpaid = 0;
  let scholarshipPaidUndone = 0;
  for (const d of deposits) {
    const b = depositDocBucket(d.depositType, monthByDeposit[d.id]);
    if (d.depositType === "salary_slip") {
      if (b === "done") salaryDoneUnpaid++;
      if (b === "paid") salaryPaidUndone++;
    }
    if (d.depositType === "kollel_scholarship") {
      if (b === "done") scholarshipDoneUnpaid++;
      if (b === "paid") scholarshipPaidUndone++;
    }
  }

  const allCards: Record<string, KpiCard> = {
    waiting_client: {
      id: "waiting_client",
      label: "ממתין ללקוח",
      value: doneUnpaidCount,
      icon: Clock,
      color: "amber",
      href: "/deposits?tab=done",
      hint: "בוצע — ממתין לתשלום",
    },
    waiting_advisor: {
      id: "waiting_advisor",
      label: "ממתין לטיפול יועץ",
      value: neitherCount + paidUndoneCount,
      icon: BellRing,
      color: "purple",
      href: "/deposits?tab=pending",
      hint: "טרם בוצעה הפעולה",
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
    action_pending: {
      id: "action_pending",
      label: "ממתין לביצוע פעולה",
      value: neitherCount + paidUndoneCount,
      icon: AlertCircle,
      color: "amber",
      href: "/deposits?tab=pending",
      hint: "טרם בוצע תלוש / מילגה / העברה",
    },
    payment_pending: {
      id: "payment_pending",
      label: "בוצע ולא שולם",
      value: doneUnpaidCount,
      icon: Banknote,
      color: "rose",
      href: "/deposits?tab=done",
      hint: "פעולה בוצעה — ממתין לתשלום",
    },
    salary_done_unpaid: {
      id: "salary_done_unpaid",
      label: "תלוש — בוצע לא שולם",
      value: salaryDoneUnpaid,
      icon: Banknote,
      color: "gold",
      href: "/deposits?tab=done",
    },
    salary_paid_undone: {
      id: "salary_paid_undone",
      label: "תלוש — שולם לא בוצע",
      value: salaryPaidUndone,
      icon: Clock,
      color: "amber",
      href: "/deposits?tab=paid",
    },
    scholarship_done_unpaid: {
      id: "scholarship_done_unpaid",
      label: "מילגה — בוצע לא שולם",
      value: scholarshipDoneUnpaid,
      icon: Banknote,
      color: "gold",
      href: "/deposits?tab=done",
    },
    scholarship_paid_undone: {
      id: "scholarship_paid_undone",
      label: "מילגה — שולם לא בוצע",
      value: scholarshipPaidUndone,
      icon: Clock,
      color: "amber",
      href: "/deposits?tab=paid",
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
      label: "טופלו (ארכיון)",
      value: fullyDoneCount,
      icon: CheckCircle2,
      color: "green",
      href: "/deposits?tab=archive",
      hint: "בוצע וגם שולם (לפי תיעוד)",
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
      value: activeDeposits,
      icon: Banknote,
      color: "green",
      href: "/deposits",
    },
  };

  const activeIds = getActiveDashboardCards(user.dashboardCards || null);
  const stats = activeIds.map((id) => allCards[id]).filter(Boolean) as KpiCard[];

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
          <h1 className="section-title mb-3">לוח בקרה הפקדות</h1>
          <p className="section-subtitle">
            סקירה לפי תיעוד ביצוע ותשלום — אותם מספרים כמו בלשונית הפקדות
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link href="/deposits" className="btn-primary">
            <Banknote size={18} /> ניהול הפקדות
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <HighlightCard
          title="לא בוצע ולא שולם"
          value={neitherCount}
          description="ממתין לביצוע ולתשלום"
          accent="amber"
          href="/deposits?tab=pending"
        />
        <HighlightCard
          title="בוצע ולא שולם"
          value={doneUnpaidCount}
          description="הפעולה בוצעה — ממתין לתשלום"
          accent="gold"
          href="/deposits?tab=done"
        />
        <HighlightCard
          title="שולם ולא בוצע"
          value={paidUndoneCount}
          description="שולם — הפעולה טרם בוצעה"
          accent="rose"
          href="/deposits?tab=paid"
        />
        <HighlightCard
          title="טופלו (ארכיון)"
          value={fullyDoneCount}
          description="בוצע וגם שולם (לפי תיעוד)"
          accent="green"
          href="/deposits?tab=archive"
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
                style={{
                  animationDelay: `${i * 60}ms`,
                  animationFillMode: "backwards",
                }}
              >
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="kpi-label">{s.label}</div>
                    <div className="kpi-value">
                      <AnimatedCounter value={s.value} />
                    </div>
                    {s.hint && (
                      <div className="text-xs text-navy-600 mt-2">{s.hint}</div>
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

function formatDateHe(d: Date): string {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return d.toLocaleDateString("he-IL");
  }
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
  accent: "amber" | "gold" | "rose" | "green";
  href: string;
}) {
  const tones: Record<string, string> = {
    amber: "from-amber-50 to-amber-100/40 border-amber-200",
    gold: "from-gold-50 to-gold-100/30 border-gold-300/50",
    rose: "from-rose-50 to-rose-100/40 border-rose-200",
    green: "from-teal-50 to-emerald-50 border-teal-200",
  };
  return (
    <Link
      href={href}
      className={`rounded-2xl border bg-gradient-to-br ${tones[accent]} p-5 hover:shadow-md transition-shadow block`}
    >
      <div className="text-sm font-semibold text-navy-800 mb-1">{title}</div>
      <div className="text-3xl font-heading font-bold text-navy-950 mb-1">
        <AnimatedCounter value={value} />
      </div>
      <div className="text-xs text-navy-600">{description}</div>
    </Link>
  );
}
