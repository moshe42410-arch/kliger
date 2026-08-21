import { redirect } from "next/navigation";
import {
  getSql,
  parseClient,
  parseDeposit,
  parseAssociation,
  parseReminder,
  type ClientRow,
  type DepositRow,
  type AssociationRow,
  type ReminderRow,
  type Reminder,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ensureRemindersForDeposit } from "@/lib/reminders";
import { DepositsTab } from "@/components/DepositsTab";
import { depositRequiresPayment, type DepositType } from "@/lib/types";
import { monthBucketOf } from "@/lib/db";

export const dynamic = "force-dynamic";

function isDocComplete(rem: Reminder, depositType: DepositType): boolean {
  const action = !!rem.actionDoneAt;
  const paid = !!(rem.paymentDoneAt || rem.paidAt);
  if (!depositRequiresPayment(depositType)) return action;
  return action && paid;
}

export default async function DepositsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sql = getSql();
  const ownerId = user.id;
  const nowIso = new Date().toISOString();

  const [depositRows, clientRows, associationRows, reminderCounts] =
    await Promise.all([
      sql`SELECT * FROM deposits WHERE owner_id = ${ownerId} ORDER BY created_at DESC`,
      sql`SELECT * FROM clients WHERE owner_id = ${ownerId} ORDER BY name ASC`,
      sql`SELECT * FROM associations WHERE owner_id = ${ownerId} ORDER BY name ASC`,
      sql`
        SELECT deposit_id, COUNT(*)::int as c, MAX(last_sent_at) as last_sent, MAX(sends_count)::int as sends
        FROM reminders WHERE owner_id = ${ownerId} GROUP BY deposit_id
      `,
    ]);

  const deposits = (depositRows as DepositRow[]).map(parseDeposit);
  const clients = (clientRows as ClientRow[]).map(parseClient);
  const associations = (associationRows as AssociationRow[]).map(
    parseAssociation
  );

  // פותח תזכורת חודשית כשהגיע מועד "ימים לפני"
  for (const d of deposits) {
    if (d.active) {
      try {
        await ensureRemindersForDeposit(d);
      } catch {
        // ignore per-deposit ensure errors
      }
    }
  }

  // תזכורות לתיעוד: שחלון הפתיחה הגיע, או ששייכות לחודש הנוכחי
  // (כדי לאפשר סימון בוצע/שולם גם לפני מועד התזכורת)
  const currentBucket = monthBucketOf(new Date());
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

  const metaMap: Record<string, { sends: number; lastSent: string | null }> =
    {};
  for (const r of reminderCounts as Array<{
    deposit_id: string;
    c: number;
    last_sent: string | null;
    sends: number;
  }>) {
    metaMap[r.deposit_id] = { sends: r.sends || 0, lastSent: r.last_sent };
  }

  const depositById = Object.fromEntries(deposits.map((d) => [d.id, d]));

  // תזכורת פעילה לתיעוד: קודם לא-הושלמה, אחרת האחרונה לחודש (לארכיון)
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
    const existingDone = isDocComplete(existing, dep.depositType);
    const incomingDone = isDocComplete(r, dep.depositType);
    if (existingDone && !incomingDone) {
      monthByDeposit[r.depositId] = r;
    }
  }

  return (
    <DepositsTab
      initialDeposits={deposits}
      clients={clients}
      associations={associations}
      reminderMeta={metaMap}
      openReminders={monthByDeposit}
    />
  );
}
