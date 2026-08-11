import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  currentMonthBucket,
  getSql,
  nowIso,
  parseAssociation,
  parseClient,
  parseDeposit,
  parseReminder,
  type AssociationRow,
  type ClientRow,
  type DepositRow,
  type Reminder,
  type ReminderRow,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  RemindersTab,
  type ReminderUploadInfo,
} from "@/components/RemindersTab";
import { deriveReminderStatusFromDocs } from "@/lib/reminder-inbox";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sql = getSql();
  const ownerId = user.id;

  const bucket = currentMonthBucket();

  const [reminderRows, clientRows, depositRows, assocRows, msgCountRows, uploadRows] =
    await Promise.all([
      sql`
        SELECT * FROM reminders
        WHERE owner_id = ${ownerId}
          AND (month_bucket = ${bucket} OR status = 'carried_over' OR status = 'snoozed')
        ORDER BY
          CASE status
            WHEN 'waiting_advisor' THEN 0
            WHEN 'waiting_association' THEN 1
            WHEN 'waiting_client' THEN 2
            WHEN 'snoozed' THEN 3
            WHEN 'carried_over' THEN 4
            WHEN 'resolved' THEN 5
          END,
          target_date ASC
      `,
      sql`SELECT * FROM clients WHERE owner_id = ${ownerId}`,
      sql`SELECT * FROM deposits WHERE owner_id = ${ownerId}`,
      sql`SELECT * FROM associations WHERE owner_id = ${ownerId}`,
      sql`
        SELECT reminder_id, COUNT(*)::int as c,
          SUM(CASE WHEN direction='in' THEN 1 ELSE 0 END)::int as incoming
        FROM messages WHERE owner_id = ${ownerId} GROUP BY reminder_id
      `,
      sql`
        SELECT id, reminder_id, original_name, mime_type, size, uploaded_at
        FROM uploads WHERE owner_id = ${ownerId} ORDER BY uploaded_at ASC
      `,
    ]);

  const deposits = (depositRows as DepositRow[]).map(parseDeposit);
  const depositById = Object.fromEntries(deposits.map((d) => [d.id, d]));

  // סנכרון סטטוס לפי תיעוד (בוצע/שולם) — כדי שלא יישאר «ממתין ללקוח» אחרי ששולם
  const reminders: Reminder[] = [];
  for (const row of reminderRows as ReminderRow[]) {
    const r = parseReminder(row);
    const dep = depositById[r.depositId];
    if (dep) {
      const next = deriveReminderStatusFromDocs(r, dep.depositType);
      if (next !== r.status) {
        await sql`
          UPDATE reminders
          SET status = ${next}, updated_at = ${nowIso()}
          WHERE id = ${r.id}
        `;
        r.status = next;
      }
    }
    reminders.push(r);
  }

  const clients = (clientRows as ClientRow[]).map(parseClient);
  const associations = (assocRows as AssociationRow[]).map(parseAssociation);

  const messageCounts: Record<string, { total: number; incoming: number }> = {};
  for (const r of msgCountRows as Array<{
    reminder_id: string;
    c: number;
    incoming: number;
  }>) {
    messageCounts[r.reminder_id] = { total: r.c, incoming: r.incoming };
  }

  const uploads: Record<string, ReminderUploadInfo[]> = {};
  for (const u of uploadRows as Array<{
    id: string;
    reminder_id: string;
    original_name: string;
    mime_type: string | null;
    size: number | null;
    uploaded_at: string;
  }>) {
    (uploads[u.reminder_id] ||= []).push({
      id: u.id,
      originalName: u.original_name,
      mimeType: u.mime_type,
      size: u.size,
      uploadedAt: u.uploaded_at,
    });
  }

  return (
    <Suspense fallback={null}>
      <RemindersTab
        initialReminders={reminders}
        clients={clients}
        deposits={deposits}
        associations={associations}
        messageCounts={messageCounts}
        uploads={uploads}
      />
    </Suspense>
  );
}
