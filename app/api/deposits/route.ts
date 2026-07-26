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
import { ensureRemindersForDeposit } from "@/lib/reminders";

export const dynamic = "force-dynamic";

const DEPOSIT_TYPES: DepositType[] = [
  "salary_slip",
  "kollel_scholarship",
  "private_transfer",
  "cash_check",
];
const RESPONSIBILITIES: DepositResponsibility[] = ["advisor", "client"];
const RECIPIENTS: ReminderRecipient[] = ["advisor", "client", "both"];

export async function GET() {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM deposits WHERE owner_id = ${ownerId} ORDER BY created_at DESC
    `;
    return NextResponse.json((rows as DepositRow[]).map(parseDeposit));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

interface DepositPayloadInput {
  clientId: string;
  associationId: string | null;
  depositType: DepositType;
  responsibility: DepositResponsibility;
  amount: number;
  dayOfMonth: number;
  daysBeforeReminder: number;
  startDate: string;
  endDate: string | null;
  reminderRecipient: ReminderRecipient;
  active: boolean;
  notes: string | null;
}

function validate(body: unknown): DepositPayloadInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const clientId = String(b.clientId || "");
  if (!clientId) throw new Error("יש לבחור לקוח");
  const associationId = b.associationId ? String(b.associationId) : null;
  const depositType = b.depositType as DepositType;
  if (!DEPOSIT_TYPES.includes(depositType))
    throw new Error("סוג הפקדה לא תקין");
  const responsibility = b.responsibility as DepositResponsibility;
  if (!RESPONSIBILITIES.includes(responsibility))
    throw new Error("אחריות לא תקינה");
  const amount = Number(b.amount);
  if (!isFinite(amount) || amount <= 0) throw new Error("סכום לא תקין");
  const dayOfMonth = Math.floor(Number(b.dayOfMonth));
  if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)
    throw new Error("יום בחודש חייב להיות בין 1 ל-31");
  const daysBeforeReminder = Math.floor(Number(b.daysBeforeReminder ?? 5));
  if (
    !Number.isFinite(daysBeforeReminder) ||
    daysBeforeReminder < 0 ||
    daysBeforeReminder > 30
  )
    throw new Error("מספר ימים לפני התזכורת חייב להיות בין 0 ל-30");
  const startDate = String(b.startDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate))
    throw new Error("תאריך התחלה לא תקין");
  const endDateRaw = b.endDate ? String(b.endDate).slice(0, 10) : null;
  if (endDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(endDateRaw))
    throw new Error("תאריך סיום לא תקין");
  if (endDateRaw && endDateRaw < startDate)
    throw new Error("תאריך סיום חייב להיות אחרי תאריך ההתחלה");
  const reminderRecipient = b.reminderRecipient as ReminderRecipient;
  if (!RECIPIENTS.includes(reminderRecipient))
    throw new Error("נמען התזכורת לא תקין");
  const active = b.active === undefined ? true : Boolean(b.active);
  const notes = b.notes ? String(b.notes) : null;
  return {
    clientId,
    associationId,
    depositType,
    responsibility,
    amount,
    dayOfMonth,
    daysBeforeReminder,
    startDate,
    endDate: endDateRaw,
    reminderRecipient,
    active,
    notes,
  };
}

export async function POST(req: NextRequest) {
  try {
    const ownerId = await getCurrentOwnerId();
    const body = await req.json();
    const v = validate(body);
    const sql = getSql();

    const clientRows = await sql`
      SELECT id FROM clients WHERE id = ${v.clientId} AND owner_id = ${ownerId}
    `;
    if (!clientRows[0])
      return NextResponse.json({ error: "לקוח לא קיים" }, { status: 400 });

    if (v.associationId) {
      const assocRows = await sql`
        SELECT id FROM associations WHERE id = ${v.associationId} AND owner_id = ${ownerId}
      `;
      if (!assocRows[0])
        return NextResponse.json(
          { error: "העמותה שנבחרה לא קיימת" },
          { status: 400 }
        );
    }

    const id = uuid();
    await sql`
      INSERT INTO deposits (
        id, owner_id, client_id, association_id, deposit_type, responsibility,
        amount, day_of_month, days_before_reminder, start_date, end_date,
        reminder_recipient, active, notes
      ) VALUES (
        ${id}, ${ownerId}, ${v.clientId}, ${v.associationId}, ${v.depositType},
        ${v.responsibility}, ${v.amount}, ${v.dayOfMonth}, ${v.daysBeforeReminder},
        ${v.startDate}, ${v.endDate}, ${v.reminderRecipient}, ${v.active ? 1 : 0}, ${v.notes}
      )
    `;

    const rows = await sql`SELECT * FROM deposits WHERE id = ${id}`;
    const deposit = parseDeposit((rows as DepositRow[])[0]);
    if (deposit.active) await ensureRemindersForDeposit(deposit);
    return NextResponse.json(deposit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
