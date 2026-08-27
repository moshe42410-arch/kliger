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
import {
  nearbyMonthBuckets,
  pickOpenDocReminder,
} from "@/lib/deposit-doc-reminders";

export const dynamic = "force-dynamic";

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

  // תזכורות לתיעוד: חודש קודם / נוכחי / הבא + כל תזכורת שכבר סומנה
  const { prev, current, next } = nearbyMonthBuckets(new Date());
  const dueRemRows = await sql`
    SELECT * FROM reminders
    WHERE owner_id = ${ownerId}
      AND phase = 'primary'
      AND (
        scheduled_for <= ${nowIso}
        OR month_bucket = ${prev}
        OR month_bucket = ${current}
        OR month_bucket = ${next}
        OR action_done_at IS NOT NULL
        OR payment_done_at IS NOT NULL
        OR paid_at IS NOT NULL
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
  const byDeposit: Record<string, Reminder[]> = {};
  for (const row of dueRemRows as ReminderRow[]) {
    const r = parseReminder(row);
    if (!depositById[r.depositId]) continue;
    (byDeposit[r.depositId] ||= []).push(r);
  }

  const monthByDeposit: Record<string, Reminder> = {};
  for (const d of deposits) {
    const picked = pickOpenDocReminder(byDeposit[d.id] || [], d);
    if (picked) monthByDeposit[d.id] = picked;
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
