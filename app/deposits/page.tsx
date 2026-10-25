import { redirect } from "next/navigation";
import {
  ensureSchemaExtras,
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
import { listMonthDocReminders } from "@/lib/deposit-doc-reminders";

export const dynamic = "force-dynamic";

export default async function DepositsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await ensureSchemaExtras();
  const sql = getSql();
  const ownerId = user.id;

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

  // כל חודשי התיעוד: חודש נוכחי נפתח ב-1, וחודשים קודמים נשארים עד שנסגרים
  const dueRemRows = await sql`
    SELECT * FROM reminders
    WHERE owner_id = ${ownerId}
      AND phase = 'primary'
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

  const monthReminders: Reminder[] = [];
  for (const d of deposits) {
    monthReminders.push(...listMonthDocReminders(byDeposit[d.id] || []));
  }

  const fileRows = (await sql`
    SELECT reminder_id, COUNT(*)::int AS c
    FROM uploads WHERE owner_id = ${ownerId}
    GROUP BY reminder_id
  `) as Array<{ reminder_id: string; c: number }>;
  const msgRows = (await sql`
    SELECT reminder_id,
      COUNT(*)::int AS c,
      SUM(CASE WHEN direction = 'in' THEN 1 ELSE 0 END)::int AS incoming
    FROM messages WHERE owner_id = ${ownerId}
    GROUP BY reminder_id
  `) as Array<{ reminder_id: string; c: number; incoming: number }>;
  const rowActivity: Record<
    string,
    { files: number; messages: number; incoming: number }
  > = {};
  for (const r of fileRows) {
    rowActivity[r.reminder_id] = {
      files: Number(r.c) || 0,
      messages: 0,
      incoming: 0,
    };
  }
  for (const r of msgRows) {
    const cur = rowActivity[r.reminder_id] || {
      files: 0,
      messages: 0,
      incoming: 0,
    };
    cur.messages = Number(r.c) || 0;
    cur.incoming = Number(r.incoming) || 0;
    rowActivity[r.reminder_id] = cur;
  }

  return (
    <DepositsTab
      initialDeposits={deposits}
      clients={clients}
      associations={associations}
      reminderMeta={metaMap}
      monthReminders={monthReminders}
      rowActivity={rowActivity}
    />
  );
}
