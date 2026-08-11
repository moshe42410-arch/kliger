import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  nowIso,
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const body = await req.json();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM deposits WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    const row = (rows as DepositRow[])[0];
    if (!row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    if (typeof body.active === "boolean") {
      await sql`
        UPDATE deposits SET active = ${body.active ? 1 : 0}, updated_at = ${nowIso()}
        WHERE id = ${params.id}
      `;
    }
    if (typeof body.notes === "string") {
      await sql`
        UPDATE deposits SET notes = ${body.notes}, updated_at = ${nowIso()}
        WHERE id = ${params.id}
      `;
    }

    const upd = await sql`SELECT * FROM deposits WHERE id = ${params.id}`;
    return NextResponse.json(parseDeposit((upd as DepositRow[])[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const body = await req.json();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM deposits WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    const row = (rows as DepositRow[])[0];
    if (!row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    const b = body as Record<string, unknown>;
    const clientId = String(b.clientId || "");
    if (!clientId)
      return NextResponse.json({ error: "יש לבחור לקוח" }, { status: 400 });
    const associationId = b.associationId ? String(b.associationId) : null;
    const depositType = b.depositType as DepositType;
    if (!DEPOSIT_TYPES.includes(depositType))
      return NextResponse.json({ error: "סוג הפקדה לא תקין" }, { status: 400 });
    const responsibility = b.responsibility as DepositResponsibility;
    if (!RESPONSIBILITIES.includes(responsibility))
      return NextResponse.json({ error: "אחריות לא תקינה" }, { status: 400 });
    const amount = Number(b.amount);
    if (!isFinite(amount) || amount <= 0)
      return NextResponse.json({ error: "סכום לא תקין" }, { status: 400 });
    const dayOfMonth = Math.floor(Number(b.dayOfMonth));
    if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)
      return NextResponse.json(
        { error: "יום בחודש חייב להיות בין 1 ל-31" },
        { status: 400 }
      );
    const daysBeforeReminder = Math.floor(Number(b.daysBeforeReminder ?? 5));
    if (
      !Number.isFinite(daysBeforeReminder) ||
      daysBeforeReminder < 0 ||
      daysBeforeReminder > 30
    )
      return NextResponse.json(
        { error: "מספר ימים לפני התזכורת חייב להיות בין 0 ל-30" },
        { status: 400 }
      );
    const startDate = String(b.startDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate))
      return NextResponse.json({ error: "תאריך התחלה לא תקין" }, { status: 400 });
    const endDate = b.endDate ? String(b.endDate).slice(0, 10) : null;
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))
      return NextResponse.json({ error: "תאריך סיום לא תקין" }, { status: 400 });
    if (endDate && endDate < startDate)
      return NextResponse.json(
        { error: "תאריך סיום חייב להיות אחרי תאריך ההתחלה" },
        { status: 400 }
      );
    const reminderRecipient = (b.reminderRecipient ||
      "advisor") as ReminderRecipient;
    if (!RECIPIENTS.includes(reminderRecipient))
      return NextResponse.json(
        { error: "נמען התזכורת לא תקין" },
        { status: 400 }
      );
    const notes = b.notes ? String(b.notes) : null;
    const active = b.active === undefined ? !!row.active : Boolean(b.active);
    let scholarshipDelivery: string | null = null;
    if (depositType === "kollel_scholarship") {
      const raw = String(b.scholarshipDelivery || "cash");
      if (raw !== "cash" && raw !== "transfer") {
        return NextResponse.json(
          { error: "אופן מילגה לא תקין" },
          { status: 400 }
        );
      }
      scholarshipDelivery = raw;
    }

    const clientRows = (await sql`
      SELECT id FROM clients WHERE id = ${clientId} AND owner_id = ${ownerId}
    `) as Array<{ id: string }>;
    if (!clientRows[0])
      return NextResponse.json({ error: "לקוח לא קיים" }, { status: 400 });
    if (associationId) {
      const assocRows = (await sql`
        SELECT id FROM associations WHERE id = ${associationId} AND owner_id = ${ownerId}
      `) as Array<{ id: string }>;
      if (!assocRows[0])
        return NextResponse.json(
          { error: "העמותה שנבחרה לא קיימת" },
          { status: 400 }
        );
    }

    await sql`
      UPDATE deposits SET
        client_id = ${clientId},
        association_id = ${associationId},
        deposit_type = ${depositType},
        responsibility = ${responsibility},
        amount = ${amount},
        day_of_month = ${dayOfMonth},
        days_before_reminder = ${daysBeforeReminder},
        start_date = ${startDate},
        end_date = ${endDate},
        reminder_recipient = ${reminderRecipient},
        scholarship_delivery = ${scholarshipDelivery},
        active = ${active ? 1 : 0},
        notes = ${notes},
        updated_at = ${nowIso()}
      WHERE id = ${params.id}
    `;

    const upd = await sql`SELECT * FROM deposits WHERE id = ${params.id}`;
    const deposit = parseDeposit((upd as DepositRow[])[0]);
    if (deposit.active) await ensureRemindersForDeposit(deposit);
    return NextResponse.json(deposit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const deleted = (await sql`
      DELETE FROM deposits WHERE id = ${params.id} AND owner_id = ${ownerId}
      RETURNING id
    `) as Array<{ id: string }>;
    if (!deleted[0]) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
