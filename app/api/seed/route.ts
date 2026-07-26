import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import {
  getSql,
  parseDeposit,
  type DepositRow,
  type DepositType,
  type DepositResponsibility,
  type ReminderRecipient,
} from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";
import { ensureRemindersForDeposit, logMessage } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * מכניס דאטת דמו לפי הסכימה החדשה - 4 סוגי הפקדה, responsibility, שדות תקופה.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const demoEmail = String(
      body.email || process.env.SMTP_USER || "demo@example.com"
    );

    const ownerId = await getCurrentOwnerId();
    const sql = getSql();

    await sql`DELETE FROM messages WHERE owner_id = ${ownerId}`;
    await sql`DELETE FROM uploads WHERE owner_id = ${ownerId}`;
    await sql`DELETE FROM reminders WHERE owner_id = ${ownerId}`;
    await sql`DELETE FROM deposits WHERE owner_id = ${ownerId}`;
    await sql`DELETE FROM clients WHERE owner_id = ${ownerId}`;
    await sql`DELETE FROM associations WHERE owner_id = ${ownerId}`;

    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 10);

    const clients = [
      {
        id: uuid(),
        name: "דוד כהן",
        emails: [demoEmail],
        phones: ["050-1234567"],
        channel: "email" as const,
      },
      {
        id: uuid(),
        name: "שרה לוי",
        emails: [demoEmail],
        phones: ["052-9876543", "03-1234567"],
        channel: "both" as const,
      },
      {
        id: uuid(),
        name: "יוסי אברהם",
        emails: [demoEmail, "yossi.work@example.com"],
        phones: ["054-5555555"],
        channel: "email" as const,
      },
    ];
    for (const c of clients) {
      await sql`
        INSERT INTO clients (id, owner_id, name, emails, phones, reminder_channel)
        VALUES (${c.id}, ${ownerId}, ${c.name}, ${JSON.stringify(c.emails)}, ${JSON.stringify(c.phones)}, ${c.channel})
      `;
    }

    const association = {
      id: uuid(),
      name: "עמותת ההסדר לדוגמה",
      email: demoEmail,
      bank: "12",
      branch: "601",
      account: "12345678",
    };
    await sql`
      INSERT INTO associations (id, owner_id, name, email, bank_number, branch_number, account_number)
      VALUES (${association.id}, ${ownerId}, ${association.name}, ${association.email}, ${association.bank}, ${association.branch}, ${association.account})
    `;

    function clampDay(n: number): number {
      if (n < 1) return 1;
      if (n > 28) return 28;
      return n;
    }

    interface DepositSeed {
      id: string;
      clientId: string;
      associationId: string | null;
      depositType: DepositType;
      responsibility: DepositResponsibility;
      amount: number;
      dayOfMonth: number;
      daysBefore: number;
      recipient: ReminderRecipient;
      notes: string;
    }

    const deposits: DepositSeed[] = [
      {
        id: uuid(),
        clientId: clients[0].id,
        associationId: association.id,
        depositType: "salary_slip",
        responsibility: "advisor",
        amount: 12000,
        dayOfMonth: 10,
        daysBefore: 5,
        recipient: "advisor",
        notes: "תלוש משכורת חודשי",
      },
      {
        id: uuid(),
        clientId: clients[0].id,
        associationId: association.id,
        depositType: "kollel_scholarship",
        responsibility: "advisor",
        amount: 3000,
        dayOfMonth: clampDay(today.getDate() + 3),
        daysBefore: 5,
        recipient: "both",
        notes: "מילגה מכולל",
      },
      {
        id: uuid(),
        clientId: clients[1].id,
        associationId: association.id,
        depositType: "private_transfer",
        responsibility: "advisor",
        amount: 5500,
        dayOfMonth: clampDay(today.getDate() + 1),
        daysBefore: 10,
        recipient: "advisor",
        notes: "העברה ממקור פרטי",
      },
      {
        id: uuid(),
        clientId: clients[1].id,
        associationId: null,
        depositType: "cash_check",
        responsibility: "client",
        amount: 2800,
        dayOfMonth: 15,
        daysBefore: 5,
        recipient: "client",
        notes: "הפקדה עצמית של הלקוח",
      },
      {
        id: uuid(),
        clientId: clients[2].id,
        associationId: association.id,
        depositType: "salary_slip",
        responsibility: "advisor",
        amount: 18500,
        dayOfMonth: 28,
        daysBefore: 7,
        recipient: "advisor",
        notes: "תלוש בכיר",
      },
    ];

    for (const d of deposits) {
      await sql`
        INSERT INTO deposits (
          id, owner_id, client_id, association_id, deposit_type, responsibility,
          amount, day_of_month, days_before_reminder, start_date, end_date,
          reminder_recipient, active, notes
        ) VALUES (
          ${d.id}, ${ownerId}, ${d.clientId}, ${d.associationId}, ${d.depositType}, ${d.responsibility},
          ${d.amount}, ${d.dayOfMonth}, ${d.daysBefore}, ${startDate}, NULL,
          ${d.recipient}, 1, ${d.notes}
        )
      `;
    }

    const depositRows = await sql`SELECT * FROM deposits WHERE owner_id = ${ownerId}`;
    const allDeposits = (depositRows as DepositRow[]).map(parseDeposit);
    for (const d of allDeposits) {
      await ensureRemindersForDeposit(d);
    }

    const reminderRows = await sql`
      SELECT id, deposit_id, target_date, phase FROM reminders
      WHERE owner_id = ${ownerId} ORDER BY target_date ASC
    `;
    const allReminders = reminderRows as Array<{
      id: string;
      deposit_id: string;
      target_date: string;
      phase: string;
    }>;

    if (allReminders.length >= 1) {
      const rid = allReminders[0].id;
      await logMessage({
        reminderId: rid,
        direction: "out",
        subject: "תזכורת אוטומטית לדוגמה",
        body: "לקוח יקר, יש להיערך עם ההפקדה הקרובה.",
        emailStatus: "sent",
        metadata: { type: "automatic-reminder" },
      });
    }

    const [cCount, dCount, rCount] = await Promise.all([
      sql`SELECT COUNT(*)::int as c FROM clients WHERE owner_id = ${ownerId}`,
      sql`SELECT COUNT(*)::int as c FROM deposits WHERE owner_id = ${ownerId}`,
      sql`SELECT COUNT(*)::int as c FROM reminders WHERE owner_id = ${ownerId}`,
    ]);
    const counts = {
      clients: Number((cCount as Array<{ c: number }>)[0]?.c ?? 0),
      deposits: Number((dCount as Array<{ c: number }>)[0]?.c ?? 0),
      reminders: Number((rCount as Array<{ c: number }>)[0]?.c ?? 0),
    };

    return NextResponse.json({ ok: true, counts, email: demoEmail });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
