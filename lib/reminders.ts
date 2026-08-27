import { addDays, parseISO, isBefore, format, startOfDay } from "date-fns";
import { v4 as uuid } from "uuid";
import {
  getSql,
  getUserById,
  userAsAdvisor,
  listAllActiveUsers,
  parseClient,
  parseDeposit,
  parseReminder,
  parseMessage,
  parseAssociation,
  nowIso,
  type Association,
  type AssociationRow,
  type Deposit,
  type Client,
  type Reminder,
  type Message,
  type MessageDirection,
  type MessageRow,
  type ReminderPhase,
  monthBucketOf,
  currentMonthBucket,
  type ClientRow,
  type DepositRow,
  type ReminderRow,
} from "./db";
import { sendEmail } from "./email";
import { getBlobBytes } from "./blob-storage";
import { depositTypeLabel, depositRequiresPayment, scholarshipDeliveryLabel } from "./types";
import { deriveReminderStatusFromDocs } from "./reminder-inbox";
import { documentationOccurrenceDate } from "./deposit-doc-reminders";
import { isShabbatOrHoliday, isErevChag } from "./shabbat";
import {
  mergeTemplates,
  renderTemplate,
  type TemplateId,
  type TemplateVars,
} from "./email-templates";

const VERIFY_PAYMENT_DELAY_DAYS = 1;
const ESCALATE_TO_CLIENT_AFTER_DAYS = 3;

function isTargetReachedOrPassed(targetDateIso: string): boolean {
  try {
    const target = startOfDay(parseISO(targetDateIso));
    const today = startOfDay(new Date());
    return !isBefore(today, target);
  } catch {
    return false;
  }
}

function buildClientActionLine(deposit: Deposit, targetDateIso: string): string {
  const amount = formatCurrency(deposit.amount);
  const reached = isTargetReachedOrPassed(targetDateIso);
  switch (deposit.depositType) {
    case "salary_slip":
      return `יש לדאוג בהקדם למזומן בסך ${amount} עבור תלוש משכורת ${
        reached ? "שנכנס לחשבון" : "שעתיד להיכנס לחשבונך"
      }`;
    case "kollel_scholarship": {
      const method =
        scholarshipDeliveryLabel[deposit.scholarshipDelivery || "cash"];
      return `יש לדאוג בהקדם ל${method} עבור מילגה ${
        reached ? "שנכנסה" : "שעתידה להיכנס"
      } לחשבונך`;
    }
    case "private_transfer":
      return `יש לדאוג בהקדם להעברה עם סוג פעולה משכורת — נא להעלות אסמכתא בקישור המצורף לאחר שהעברה בוצעה`;
    case "cash_check":
      return `יש לדאוג בהקדם להפקדת מזומן / צ׳ק בסך ${amount} — נא להעלות אסמכתא בקישור המצורף לאחר שההפקדה בוצעה`;
    default:
      return `יש לדאוג בהקדם להסדרת ${depositTypeLabel[deposit.depositType]} בסך ${amount}`;
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * לפי start_date, end_date, day_of_month — מחזיר את כל תאריכי היעד
 * בחלון הזמן הנתון. יוצרים תזכורות רק לחודש הנוכחי + הבא (2 חודשים).
 */
export function occurrencesInRange(
  dayOfMonth: number,
  startDate: Date,
  endDate: Date | null,
  from: Date = new Date(),
  horizonMonths = 2
): Date[] {
  const out: Date[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const startDay = startOfDay(startDate);
  const endDay = endDate ? startOfDay(endDate) : null;

  for (let i = 0; i < horizonMonths; i++) {
    const y = cur.getFullYear();
    const m = cur.getMonth() + i;
    const normY = y + Math.floor(m / 12);
    const normM = ((m % 12) + 12) % 12;
    const dim = daysInMonth(normY, normM + 1);
    const safeDay = Math.min(dayOfMonth, dim);
    const occ = new Date(normY, normM, safeDay);
    if (i === 0 && occ < cur) continue;
    if (occ < startDay) continue;
    if (endDay && occ > endDay) continue;
    out.push(occ);
  }
  return out;
}

function buildAccountBlock(association: Association | null): string {
  if (!association) return "";
  const lines: string[] = [];
  lines.push(`יש להעביר את הכספים לחשבון של ${association.name}:`);
  if (association.bankNumber) lines.push(`בנק: ${association.bankNumber}`);
  if (association.branchNumber) lines.push(`סניף: ${association.branchNumber}`);
  if (association.accountNumber)
    lines.push(`מספר חשבון: ${association.accountNumber}`);
  return lines.join("\n");
}

export function pickTemplateId(
  phase: ReminderPhase,
  recipientKind: "advisor" | "client",
  responsibility: "advisor" | "client"
): TemplateId {
  if (phase === "verify_payment") {
    return recipientKind === "advisor" ? "advisor_verify" : "client_verify";
  }
  if (responsibility === "advisor") {
    return recipientKind === "advisor"
      ? "advisor_primary_advisor_flow"
      : "client_primary_advisor_flow";
  }
  return recipientKind === "advisor"
    ? "advisor_primary_client_flow"
    : "client_primary";
}

export async function buildReminderContent(
  client: Client,
  deposit: Deposit,
  targetDateIso: string,
  uploadUrl: string,
  association: Association | null,
  phase: ReminderPhase,
  recipientKind: "advisor" | "client",
  advisorName?: string
): Promise<{ subject: string; body: string }> {
  const advisorUser = await getUserById(deposit.ownerId);
  const templates = mergeTemplates(advisorUser?.emailTemplates ?? null);

  const templateId = pickTemplateId(
    phase,
    recipientKind,
    deposit.responsibility
  );
  const template = templates[templateId];

  const accountBlock = buildAccountBlock(association);
  const clientActionLine = buildClientActionLine(deposit, targetDateIso);
  const deliveryMethod =
    scholarshipDeliveryLabel[deposit.scholarshipDelivery || "cash"];
  const timingPhrase = isTargetReachedOrPassed(targetDateIso)
    ? deposit.depositType === "kollel_scholarship"
      ? "שנכנסה"
      : "שנכנס"
    : deposit.depositType === "kollel_scholarship"
      ? "שעתידה להיכנס"
      : "שעתיד להיכנס";

  const vars: TemplateVars = {
    clientName: client.name,
    advisorName: advisorName || advisorUser?.name || "",
    advisorPhone: advisorUser?.phone || "",
    companyName: advisorUser?.companyName || advisorUser?.name || "KLIGER",
    amount: formatCurrency(deposit.amount),
    targetDate: formatHebrewDate(targetDateIso),
    depositType: depositTypeLabel[deposit.depositType],
    uploadUrl,
    associationName: association?.name || "",
    accountBlock: accountBlock ? `\n\n${accountBlock}` : "",
    daysLate: String(ESCALATE_TO_CLIENT_AFTER_DAYS),
    clientActionLine,
    deliveryMethod,
    timingPhrase,
  };

  return renderTemplate(template, vars);
}

function formatCurrency(n: number): string {
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₪${n}`;
  }
}

function formatHebrewDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

export function buildUploadUrl(token: string): string {
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/upload/${token}`;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * הפונקציה המרכזית: בהינתן הפקדה — מוודאת שיש תזכורות מתאימות בחודש הנוכחי.
 */
export async function ensureRemindersForDeposit(
  deposit: Deposit,
  options: { force?: boolean } = {}
): Promise<Reminder[]> {
  const sql = getSql();
  const cRows = await sql`SELECT * FROM clients WHERE id = ${deposit.clientId}`;
  const cRow = cRows[0] as ClientRow | undefined;
  if (!cRow) return [];
  const client = parseClient(cRow);

  let association: Association | null = null;
  if (deposit.associationId) {
    const aRows = await sql`
      SELECT * FROM associations WHERE id = ${deposit.associationId}
    `;
    const aRow = aRows[0] as AssociationRow | undefined;
    if (aRow) association = parseAssociation(aRow);
  }

  const ownerUser = await getUserById(deposit.ownerId);
  const advisor = ownerUser ? userAsAdvisor(ownerUser) : null;
  const created: Reminder[] = [];
  const now = new Date();

  const startDate = deposit.startDate ? parseISO(deposit.startDate) : now;
  const endDate = deposit.endDate ? parseISO(deposit.endDate) : null;

  async function insertReminder(
    occ: Date,
    scheduled: Date,
    phase: ReminderPhase,
    forcedBucket?: string
  ): Promise<Reminder | null> {
    const targetDateIso = toIsoDate(occ);
    const existingRows = (await sql`
      SELECT * FROM reminders
      WHERE deposit_id = ${deposit.id} AND target_date = ${targetDateIso} AND phase = ${phase}
    `) as ReminderRow[];
    if (existingRows[0]) return null;

    const id = uuid();
    const token = uuid().replace(/-/g, "");
    const uploadUrl = buildUploadUrl(token);
    const { subject, body } = await buildReminderContent(
      client,
      deposit,
      targetDateIso,
      uploadUrl,
      association,
      phase,
      "client",
      advisor?.name
    );

    // month_bucket = חודש היעד (יום ההפקדה), לא תאריך התזכורת
    const bucket = forcedBucket ?? monthBucketOf(occ);
    await sql`
      INSERT INTO reminders (id, owner_id, deposit_id, client_id, status, phase, target_date, scheduled_for, subject, body, upload_token, month_bucket)
      VALUES (${id}, ${deposit.ownerId}, ${deposit.id}, ${deposit.clientId}, 'waiting_advisor', ${phase}, ${targetDateIso}, ${scheduled.toISOString()}, ${subject}, ${body}, ${token}, ${bucket})
    `;

    const rows = await sql`SELECT * FROM reminders WHERE id = ${id}`;
    return parseReminder(rows[0] as ReminderRow);
  }

  const startDay = startOfDay(startDate);
  const endDay = endDate ? startOfDay(endDate) : null;
  const nowDay = startOfDay(now);

  // חודש קודם / נוכחי / הבא — כדי לתפוס תזכורת שנפתחת X ימים לפני (חוצה חודשים)
  const candidateOccs: Date[] = [];
  for (let i = -1; i <= 1; i++) {
    const y = now.getFullYear();
    const m = now.getMonth() + i;
    const normY = y + Math.floor(m / 12);
    const normM = ((m % 12) + 12) % 12;
    const dim = daysInMonth(normY, normM + 1);
    const occ = new Date(normY, normM, Math.min(deposit.dayOfMonth, dim));
    const o = startOfDay(occ);
    if (o < startDay) continue;
    if (endDay && o > endDay) continue;
    candidateOccs.push(occ);
  }

  for (const occ of candidateOccs) {
    const scheduledPrimary = addDays(occ, -deposit.daysBeforeReminder);
    // נפתחת רק ממועד התזכורת (למשל 5 ימים לפני יום 10)
    const windowOpen =
      options.force || startOfDay(scheduledPrimary) <= nowDay;
    if (windowOpen) {
      const r = await insertReminder(occ, scheduledPrimary, "primary");
      if (r) created.push(r);
    }
    if (deposit.responsibility === "advisor") {
      const scheduledVerify = addDays(occ, VERIFY_PAYMENT_DELAY_DAYS);
      if (options.force || startOfDay(scheduledVerify) <= nowDay) {
        const r = await insertReminder(occ, scheduledVerify, "verify_payment");
        if (r) created.push(r);
      }
    }
  }

  if (options.force && created.length === 0) {
    const wide = occurrencesInRange(
      deposit.dayOfMonth,
      startDate,
      endDate,
      now,
      12
    );
    if (wide.length > 0) {
      const occ = wide[0];
      const scheduled = addDays(occ, -deposit.daysBeforeReminder);
      const r = await insertReminder(
        occ,
        scheduled,
        "primary",
        monthBucketOf(occ)
      );
      if (r) created.push(r);
    }
  }

  return created;
}

export interface EmailRecipients {
  advisorEmails: string[];
  clientEmails: string[];
}

export type SendAudience = "advisor" | "client" | "both" | "deposit" | "auto";

export function computeRecipients(
  deposit: Deposit,
  reminder: Reminder,
  client: Client,
  advisorEmail: string | null,
  audience: SendAudience = "deposit"
): EmailRecipients {
  const clientEmails = client.emails.filter((e) => e && e.includes("@"));
  const advisorEmails =
    advisorEmail && advisorEmail.includes("@") ? [advisorEmail] : [];

  if (audience === "advisor" || audience === "auto") {
    return { advisorEmails, clientEmails: [] };
  }
  if (audience === "client") {
    return { advisorEmails: [], clientEmails };
  }
  if (audience === "both") {
    return { advisorEmails, clientEmails };
  }

  // deposit / default — respect deposit setting (used rarely; auto uses advisor)
  if (reminder.phase === "verify_payment") {
    return {
      advisorEmails,
      clientEmails: reminder.escalatedToClient ? clientEmails : [],
    };
  }
  switch (deposit.reminderRecipient) {
    case "advisor":
      return { advisorEmails, clientEmails: [] };
    case "client":
      return { advisorEmails: [], clientEmails };
    case "both":
      return { advisorEmails, clientEmails };
    default:
      return { advisorEmails: [], clientEmails };
  }
}

export async function sendReminderNow(
  reminderId: string,
  options: { audience?: SendAudience } = {}
): Promise<{
  ok: boolean;
  error?: string;
  sentTo?: string[];
}> {
  const sql = getSql();
  const rRows = await sql`SELECT * FROM reminders WHERE id = ${reminderId}`;
  const rRow = rRows[0] as ReminderRow | undefined;
  if (!rRow) return { ok: false, error: "תזכורת לא נמצאה" };
  const reminder = parseReminder(rRow);
  if (reminder.status === "resolved") {
    return { ok: false, error: "התזכורת כבר סומנה כטופלה" };
  }
  const cRows = await sql`SELECT * FROM clients WHERE id = ${reminder.clientId}`;
  const cRow = cRows[0] as ClientRow | undefined;
  if (!cRow) return { ok: false, error: "לקוח לא נמצא" };
  const client = parseClient(cRow);
  const dRows = await sql`SELECT * FROM deposits WHERE id = ${reminder.depositId}`;
  const dRow = dRows[0] as DepositRow | undefined;
  if (!dRow) return { ok: false, error: "הפקדה לא נמצאה" };
  const deposit = parseDeposit(dRow);
  if (!deposit.active) return { ok: false, error: "ההפקדה כבויה" };

  const ownerUser = await getUserById(reminder.ownerId);
  if (options.audience === "auto" && ownerUser && !ownerUser.autoRemindersEnabled) {
    return { ok: true, sentTo: [] };
  }

  let association: Association | null = null;
  if (deposit.associationId) {
    const aRows = await sql`
      SELECT * FROM associations WHERE id = ${deposit.associationId}
    `;
    const aRow = aRows[0] as AssociationRow | undefined;
    if (aRow) association = parseAssociation(aRow);
  }

  const advisor = ownerUser ? userAsAdvisor(ownerUser) : null;
  const uploadUrl = buildUploadUrl(reminder.uploadToken || "");
  const audience: SendAudience = options.audience ?? "advisor";
  const recipients = computeRecipients(
    deposit,
    reminder,
    client,
    advisor?.email ?? null,
    audience === "auto" ? "advisor" : audience
  );

  const sentTo: string[] = [];
  let firstError: string | undefined;

  if (recipients.advisorEmails.length > 0) {
    const content = await buildReminderContent(
      client,
      deposit,
      reminder.targetDate,
      uploadUrl,
      association,
      reminder.phase,
      "advisor",
      advisor?.name
    );
    const res = await sendEmail({
      to: recipients.advisorEmails,
      subject: content.subject,
      body: content.body,
      reminderId: reminder.id,
      clientId: client.id,
      fromUserId: reminder.ownerId,
    });
    await logMessage({
      reminderId: reminder.id,
      direction: "out",
      subject: content.subject,
      body: content.body,
      emailStatus: res.ok ? "sent" : "error",
      emailError: res.error ?? null,
      metadata: {
        to: recipients.advisorEmails,
        recipientKind: "advisor",
        phase: reminder.phase,
      },
    });
    if (res.ok) sentTo.push(...recipients.advisorEmails);
    else if (!firstError) firstError = res.error;
  }

  if (recipients.clientEmails.length > 0) {
    const content = await buildReminderContent(
      client,
      deposit,
      reminder.targetDate,
      uploadUrl,
      association,
      reminder.phase,
      "client",
      advisor?.name
    );
    const res = await sendEmail({
      to: recipients.clientEmails,
      subject: content.subject,
      body: content.body,
      reminderId: reminder.id,
      clientId: client.id,
      fromUserId: reminder.ownerId,
    });
    await logMessage({
      reminderId: reminder.id,
      direction: "out",
      subject: content.subject,
      body: content.body,
      emailStatus: res.ok ? "sent" : "error",
      emailError: res.error ?? null,
      metadata: {
        to: recipients.clientEmails,
        recipientKind: "client",
        phase: reminder.phase,
      },
    });
    if (res.ok) sentTo.push(...recipients.clientEmails);
    else if (!firstError) firstError = res.error;
  }

  const now = new Date().toISOString();
  await sql`
    UPDATE reminders
    SET last_sent_at = ${now}, sends_count = sends_count + 1, updated_at = ${nowIso()}
    WHERE id = ${reminder.id}
  `;

  if (sentTo.length > 0) return { ok: true, sentTo };
  return { ok: false, error: firstError || "לא נשלחו הודעות", sentTo: [] };
}

/**
 * ריצה יומית: יוצר תזכורות עתידיות, מטפל באסקלציה, שולח מיילים שנדרשים.
 */
export async function runDailyReminderSweep(): Promise<{
  created: number;
  sent: number;
  errors: number;
  escalated?: number;
  skipped?: string;
}> {
  const sql = getSql();
  let created = 0;
  let sent = 0;
  let errors = 0;
  let escalated = 0;

  const now = new Date();
  const shabbatCheck = isShabbatOrHoliday(now);
  if (shabbatCheck.blocked) {
    console.log(`[KLIGER] sweep skipped — ${shabbatCheck.reason}`);
    return {
      created: 0,
      sent: 0,
      errors: 0,
      skipped: shabbatCheck.reason ?? "shabbat/holiday",
    };
  }
  const erevCheck = isErevChag(now);
  if (erevCheck.blocked) {
    console.log(`[KLIGER] sweep skipped — ${erevCheck.reason}`);
    return {
      created: 0,
      sent: 0,
      errors: 0,
      skipped: erevCheck.reason ?? "erev chag",
    };
  }

  const activeRows = await sql`SELECT * FROM deposits WHERE active = 1`;
  const activeDeposits = (activeRows as DepositRow[]).map(parseDeposit);

  for (const deposit of activeDeposits) {
    const newOnes = await ensureRemindersForDeposit(deposit);
    created += newOnes.length;
  }

  // 1. Wake up any snoozed reminders whose time has come.
  const snoozedRows = await sql`
    SELECT * FROM reminders
    WHERE status = 'snoozed' AND snooze_until IS NOT NULL AND snooze_until <= ${now.toISOString()}
  `;
  const snoozedDue = (snoozedRows as ReminderRow[]).map(parseReminder);
  for (const r of snoozedDue) {
    await sql`
      UPDATE reminders SET status = 'waiting_advisor', snooze_until = NULL, updated_at = ${nowIso()}
      WHERE id = ${r.id}
    `;
    await notifyAdvisorSnoozeDue(r.id);
  }

  // 2. אסקלציה
  const escalateCutoff = addDays(now, -ESCALATE_TO_CLIENT_AFTER_DAYS).toISOString();
  const escalateRows = await sql`
    SELECT * FROM reminders
    WHERE phase = 'verify_payment'
      AND escalated_to_client = 0
      AND paid_at IS NULL
      AND status NOT IN ('resolved')
      AND created_at <= ${escalateCutoff}
      AND (last_sent_at IS NULL OR last_sent_at <= ${escalateCutoff})
  `;
  const toEscalate = (escalateRows as ReminderRow[]).map(parseReminder);

  for (const r of toEscalate) {
    await sql`
      UPDATE reminders SET escalated_to_client = 1, updated_at = ${nowIso()}
      WHERE id = ${r.id}
    `;
    escalated++;
    await logMessage({
      reminderId: r.id,
      direction: "system",
      subject: "אסקלציה: תזכורת עוברת ללקוח",
      body: `הלקוח לא סימן שולם תוך ${ESCALATE_TO_CLIENT_AFTER_DAYS} ימים. המערכת מתחילה לשלוח תזכורת גם ללקוח.`,
      metadata: { kind: "escalation", phase: r.phase },
    });
  }

  // 3. Pending reminders — send scheduled auto-mails.
  const pendingRows = await sql`
    SELECT * FROM reminders
    WHERE status IN ('waiting_client','carried_over','waiting_advisor')
      AND scheduled_for <= ${now.toISOString()}
      AND paid_at IS NULL
  `;
  const pending = (pendingRows as ReminderRow[]).map(parseReminder);

  for (const r of pending) {
    if (r.clientRemindAt) {
      if (isBefore(now, parseISO(r.clientRemindAt))) continue;
    } else if (r.snoozeUntil && isBefore(now, parseISO(r.snoozeUntil))) {
      continue;
    } else if (r.lastSentAt) {
      const last = parseISO(r.lastSentAt);
      const oneDayAgo = addDays(now, -1);
      if (isBefore(oneDayAgo, last)) continue;
    }

    const audience: SendAudience = r.clientRemindAt ? "client" : "auto";
    const res = await sendReminderNow(r.id, { audience });
    if (res.ok) {
      sent++;
      await sql`
        UPDATE reminders SET client_remind_at = NULL WHERE id = ${r.id}
      `;
    } else errors++;
  }

  // 4. Daily digest per user.
  await sendAdvisorPendingDigestAllUsers();

  return { created, sent, errors, escalated };
}

/**
 * מעבר חודש: מוחק resolved של חודשים קודמים, מסמן waiting_* כ-carried_over.
 */
export async function rolloverAtMonthStart(): Promise<{
  carried: number;
  deleted: number;
  created: number;
}> {
  const sql = getSql();
  const currentBucket = currentMonthBucket();

  // Note: Neon's tagged template returns the array; for rowCount we'd need
  // .query() or a full pg client. For our purposes, returning 0 is fine.
  await sql`
    DELETE FROM reminders
    WHERE (status = 'resolved' OR paid_at IS NOT NULL) AND month_bucket != ${currentBucket}
  `;

  await sql`
    UPDATE reminders
    SET status = 'carried_over', carried_over = 1, updated_at = ${nowIso()}
    WHERE month_bucket != ${currentBucket}
      AND status IN ('waiting_client','waiting_advisor')
      AND paid_at IS NULL
  `;

  let created = 0;
  const activeRows = await sql`SELECT * FROM deposits WHERE active = 1`;
  const activeDeposits = (activeRows as DepositRow[]).map(parseDeposit);
  for (const deposit of activeDeposits) {
    const newOnes = await ensureRemindersForDeposit(deposit);
    created += newOnes.length;
  }

  return {
    carried: 0, // Neon tagged template doesn't return rowCount easily
    deleted: 0,
    created,
  };
}

export async function snoozeReminder(reminderId: string, days: number): Promise<void> {
  const sql = getSql();
  const until = addDays(startOfDay(new Date()), Math.max(1, days)).toISOString();
  await sql`
    UPDATE reminders SET status = 'snoozed', snooze_until = ${until}, updated_at = ${nowIso()}
    WHERE id = ${reminderId}
  `;
}

export async function scheduleClientRemind(reminderId: string, days: number): Promise<void> {
  const sql = getSql();
  const at = addDays(startOfDay(new Date()), Math.max(1, days)).toISOString();
  await sql`
    UPDATE reminders
    SET status = 'waiting_client',
        client_remind_at = ${at},
        updated_at = ${nowIso()}
    WHERE id = ${reminderId}
  `;
  await logMessage({
    reminderId,
    direction: "system",
    subject: "תזכור את הלקוח",
    body: `הלקוח יקבל מייל תזכורת בעוד ${Math.max(1, days)} ימים (${at.slice(0, 10)}).`,
  });
}

export async function markReminderResolved(reminderId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE reminders SET status = 'resolved', updated_at = ${nowIso()}
    WHERE id = ${reminderId}
  `;
}

export async function getReminderById(reminderId: string): Promise<Reminder | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM reminders WHERE id = ${reminderId}`;
  const row = rows[0] as ReminderRow | undefined;
  return row ? parseReminder(row) : null;
}

/**
 * מחזיר תזכורת primary לחודש הנוכחי (לתיעוד בוצע/שולם),
 * ויוצר אותה במידת הצורך גם לפני מועד התזכורת.
 */
export async function getOrCreateCurrentMonthDocReminder(
  deposit: Deposit
): Promise<Reminder | null> {
  const sql = getSql();
  const occ = documentationOccurrenceDate(deposit);
  if (!occ) return null;
  const bucket = monthBucketOf(occ);
  const targetDateIso = toIsoDate(occ);

  const existing = (await sql`
    SELECT * FROM reminders
    WHERE deposit_id = ${deposit.id}
      AND phase = 'primary'
      AND (
        month_bucket = ${bucket}
        OR target_date = ${targetDateIso}
      )
    ORDER BY target_date DESC
    LIMIT 1
  `) as ReminderRow[];
  if (existing[0]) return parseReminder(existing[0]);

  await ensureRemindersForDeposit(deposit, { force: true });

  const after = (await sql`
    SELECT * FROM reminders
    WHERE deposit_id = ${deposit.id}
      AND phase = 'primary'
      AND (
        month_bucket = ${bucket}
        OR target_date = ${targetDateIso}
      )
    ORDER BY target_date DESC
    LIMIT 1
  `) as ReminderRow[];
  if (after[0]) return parseReminder(after[0]);

  // force-create the documentation occurrence even if its reminder window
  // hasn't opened yet / day-of-month already passed this calendar month
  const id = uuid();
  const token = uuid().replace(/-/g, "");
  const uploadUrl = buildUploadUrl(token);
  const cRows = await sql`SELECT * FROM clients WHERE id = ${deposit.clientId}`;
  const cRow = cRows[0] as ClientRow | undefined;
  if (!cRow) return null;
  const client = parseClient(cRow);
  let association: Association | null = null;
  if (deposit.associationId) {
    const aRows = await sql`
      SELECT * FROM associations WHERE id = ${deposit.associationId}
    `;
    const aRow = aRows[0] as AssociationRow | undefined;
    if (aRow) association = parseAssociation(aRow);
  }
  const ownerUser = await getUserById(deposit.ownerId);
  const advisor = ownerUser ? userAsAdvisor(ownerUser) : null;
  const scheduled = addDays(occ, -deposit.daysBeforeReminder);
  const { subject, body } = await buildReminderContent(
    client,
    deposit,
    targetDateIso,
    uploadUrl,
    association,
    "primary",
    "client",
    advisor?.name
  );
  await sql`
    INSERT INTO reminders (id, owner_id, deposit_id, client_id, status, phase, target_date, scheduled_for, subject, body, upload_token, month_bucket)
    VALUES (${id}, ${deposit.ownerId}, ${deposit.id}, ${deposit.clientId}, 'waiting_advisor', ${"primary"}, ${targetDateIso}, ${scheduled.toISOString()}, ${subject}, ${body}, ${token}, ${bucket})
  `;
  const rows = await sql`SELECT * FROM reminders WHERE id = ${id}`;
  return rows[0] ? parseReminder(rows[0] as ReminderRow) : null;
}

async function syncReminderStatusFromDocs(
  reminderId: string,
  depositType: Deposit["depositType"]
): Promise<void> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM reminders WHERE id = ${reminderId}`;
  const row = rows[0] as ReminderRow | undefined;
  if (!row) return;
  const reminder = parseReminder(row);
  const next = deriveReminderStatusFromDocs(reminder, depositType);
  if (next === reminder.status) return;
  await sql`
    UPDATE reminders
    SET status = ${next}, updated_at = ${nowIso()}
    WHERE id = ${reminderId}
  `;
}

/** @deprecated use syncReminderStatusFromDocs — נשמר לתאימות קריאות ישנות */
async function resolveIfComplete(
  reminderId: string,
  depositType: Deposit["depositType"]
): Promise<void> {
  await syncReminderStatusFromDocs(reminderId, depositType);
}

export async function markReminderActionDone(reminderId: string): Promise<void> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM reminders WHERE id = ${reminderId}`;
  const row = rows[0] as ReminderRow | undefined;
  if (!row) throw new Error("תזכורת לא נמצאה");
  const reminder = parseReminder(row);
  const dRows = await sql`SELECT * FROM deposits WHERE id = ${reminder.depositId}`;
  const dRow = dRows[0] as DepositRow | undefined;
  if (!dRow) throw new Error("הפקדה לא נמצאה");
  const deposit = parseDeposit(dRow);
  const now = nowIso();
  await sql`
    UPDATE reminders
    SET action_done_at = ${now}, updated_at = ${now}
    WHERE id = ${reminderId}
  `;
  await logMessage({
    reminderId,
    direction: "system",
    subject: "סומן כבוצע",
    body: `סומן שבוצעה הפעולה (${depositTypeLabel[deposit.depositType]}).`,
    metadata: { kind: "action_done" },
  });
  await syncReminderStatusFromDocs(reminderId, deposit.depositType);
}

export async function markReminderPaid(reminderId: string): Promise<void> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM reminders WHERE id = ${reminderId}`;
  const row = rows[0] as ReminderRow | undefined;
  if (!row) throw new Error("תזכורת לא נמצאה");
  const reminder = parseReminder(row);
  const dRows = await sql`SELECT * FROM deposits WHERE id = ${reminder.depositId}`;
  const dRow = dRows[0] as DepositRow | undefined;
  if (!dRow) throw new Error("הפקדה לא נמצאה");
  const deposit = parseDeposit(dRow);
  const now = nowIso();
  await sql`
    UPDATE reminders
    SET paid_at = ${now}, payment_done_at = ${now}, updated_at = ${now}
    WHERE id = ${reminderId}
  `;
  await logMessage({
    reminderId,
    direction: "system",
    subject: "סומן כשולם",
    body: "היועץ סימן שהתשלום התקבל.",
    metadata: { kind: "marked_paid" },
  });
  await syncReminderStatusFromDocs(reminderId, deposit.depositType);
}

export async function setReminderStatus(
  reminderId: string,
  status: Reminder["status"]
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE reminders SET status = ${status}, updated_at = ${nowIso()}
    WHERE id = ${reminderId}
  `;
}

export async function recordClientResponse(
  reminderId: string,
  response: string,
  metadata?: Record<string, unknown>
): Promise<Message> {
  const sql = getSql();
  await sql`
    UPDATE reminders
    SET client_response = ${response},
        client_response_at = ${nowIso()},
        status = 'waiting_advisor',
        updated_at = ${nowIso()}
    WHERE id = ${reminderId}
  `;
  return await logMessage({
    reminderId,
    direction: "in",
    subject: "תגובת לקוח",
    body: response,
    metadata: metadata ?? null,
  });
}

export interface LogMessageOptions {
  reminderId: string;
  direction: MessageDirection;
  subject?: string | null;
  body: string;
  emailStatus?: string | null;
  emailError?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logMessage(opts: LogMessageOptions): Promise<Message> {
  const sql = getSql();
  const id = uuid();
  const ownerRows = await sql`
    SELECT owner_id FROM reminders WHERE id = ${opts.reminderId}
  `;
  const reminderOwner = ownerRows[0] as { owner_id: string } | undefined;
  if (!reminderOwner) throw new Error("reminder not found for logMessage");
  const metaJson = opts.metadata ? JSON.stringify(opts.metadata) : null;
  await sql`
    INSERT INTO messages (id, owner_id, reminder_id, direction, subject, body, email_status, email_error, metadata)
    VALUES (${id}, ${reminderOwner.owner_id}, ${opts.reminderId}, ${opts.direction}, ${opts.subject ?? null}, ${opts.body}, ${opts.emailStatus ?? null}, ${opts.emailError ?? null}, ${metaJson})
  `;
  const rows = await sql`SELECT * FROM messages WHERE id = ${id}`;
  return parseMessage(rows[0] as MessageRow);
}

export async function getMessagesFor(reminderId: string): Promise<Message[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM messages WHERE reminder_id = ${reminderId} ORDER BY created_at ASC
  `;
  return (rows as MessageRow[]).map(parseMessage);
}

interface ReminderContext {
  reminder: Reminder;
  deposit: Deposit;
  client: Client;
  association: Association | null;
}

async function loadReminderContext(reminderId: string): Promise<ReminderContext | null> {
  const sql = getSql();
  const rRows = await sql`SELECT * FROM reminders WHERE id = ${reminderId}`;
  const rRow = rRows[0] as ReminderRow | undefined;
  if (!rRow) return null;
  const reminder = parseReminder(rRow);
  const dRows = await sql`SELECT * FROM deposits WHERE id = ${reminder.depositId}`;
  const dRow = dRows[0] as DepositRow | undefined;
  if (!dRow) return null;
  const deposit = parseDeposit(dRow);
  const cRows = await sql`SELECT * FROM clients WHERE id = ${reminder.clientId}`;
  const cRow = cRows[0] as ClientRow | undefined;
  if (!cRow) return null;
  const client = parseClient(cRow);
  let association: Association | null = null;
  if (deposit.associationId) {
    const aRows = await sql`
      SELECT * FROM associations WHERE id = ${deposit.associationId}
    `;
    const aRow = aRows[0] as AssociationRow | undefined;
    if (aRow) association = parseAssociation(aRow);
  }
  return { reminder, deposit, client, association };
}

async function getReminderUploads(reminderId: string): Promise<Array<{
  id: string;
  filename: string;
  originalName: string;
  mimeType: string | null;
  size: number | null;
  uploadedAt: string;
}>> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, filename, original_name, mime_type, size, uploaded_at
    FROM uploads WHERE reminder_id = ${reminderId} ORDER BY uploaded_at ASC
  `;
  return (rows as Array<{
    id: string;
    filename: string;
    original_name: string;
    mime_type: string | null;
    size: number | null;
    uploaded_at: string;
  }>).map((r) => ({
    id: r.id,
    filename: r.filename,
    originalName: r.original_name,
    mimeType: r.mime_type,
    size: r.size,
    uploadedAt: r.uploaded_at,
  }));
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 }).format(
    value
  );
}

/**
 * Forward reminder + attachments לעמותה.
 */
export async function forwardReminderToAssociation(
  reminderId: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await loadReminderContext(reminderId);
  if (!ctx) return { ok: false, error: "תזכורת לא נמצאה" };
  if (!ctx.association) {
    return { ok: false, error: "להפקדה זו לא משויכת עמותה" };
  }
  if (!ctx.association.email) {
    return { ok: false, error: "אין מייל מוגדר לעמותה" };
  }

  const uploads = await getReminderUploads(reminderId);
  const attachments = await Promise.all(
    uploads.map(async (u) => {
      const buf = await getBlobBytes(u.filename);
      return buf
        ? {
            filename: u.originalName || u.filename,
            content: buf,
            contentType: u.mimeType || undefined,
          }
        : null;
    })
  );
  const validAttachments = attachments.filter((a): a is NonNullable<typeof a> => a !== null);

  const typeLabel = depositTypeLabel[ctx.deposit.depositType];
  const targetStr = format(parseISO(ctx.reminder.targetDate), "dd/MM/yyyy");
  const ownerUser = await getUserById(ctx.reminder.ownerId);
  const templates = mergeTemplates(ownerUser?.emailTemplates ?? null);
  const rendered = renderTemplate(templates.association_transfer, {
    associationName: ctx.association.name,
    clientName: ctx.client.name,
    depositType: typeLabel,
    amount: `₪${formatAmount(ctx.deposit.amount)}`,
    targetDate: targetStr,
    fileCount: String(validAttachments.length),
    clientEmail: ctx.client.emails.length
      ? `מייל הלקוח: ${ctx.client.emails.join(", ")}`
      : "",
    clientPhone: ctx.client.phones.length
      ? `טלפון הלקוח: ${ctx.client.phones.join(", ")}`
      : "",
    companyName: ownerUser?.companyName || ownerUser?.name || "KLIGER",
  });
  const subject = rendered.subject;
  const body = rendered.body;

  const res = await sendEmail({
    to: [ctx.association.email],
    subject,
    body,
    attachments: validAttachments,
    reminderId,
    clientId: ctx.client.id,
    fromUserId: ctx.reminder.ownerId,
  });

  await logMessage({
    reminderId,
    direction: "out",
    subject,
    body,
    emailStatus: res.ok ? "sent" : "error",
    emailError: res.error ?? null,
    metadata: {
      kind: "forward_association",
      associationId: ctx.association.id,
      attachments: uploads.map((u) => u.originalName),
    },
  });

  if (res.ok) {
    const sql = getSql();
    await sql`
      UPDATE reminders SET status = 'waiting_association', updated_at = ${nowIso()}
      WHERE id = ${reminderId}
    `;
  }

  return res;
}

/**
 * הודעה ליועץ שלקוח העלה עובר-ושב (עם קובץ מצורף במייל).
 */
export async function notifyAdvisorFileUploaded(
  reminderId: string,
  uploadedFilename: string,
  originalName: string
): Promise<void> {
  const ctx = await loadReminderContext(reminderId);
  if (!ctx) return;
  const ownerUser = await getUserById(ctx.reminder.ownerId);
  if (!ownerUser) return;
  const advisor = userAsAdvisor(ownerUser);

  const targetStr = format(parseISO(ctx.reminder.targetDate), "dd/MM/yyyy");
  const baseUrl = process.env.APP_URL || "";
  const reminderLink = baseUrl ? `${baseUrl}/reminders` : "/reminders";
  const templates = mergeTemplates(ownerUser.emailTemplates);
  const rendered = renderTemplate(templates.advisor_file_uploaded, {
    advisorName: advisor.name,
    clientName: ctx.client.name,
    depositType: depositTypeLabel[ctx.deposit.depositType],
    targetDate: targetStr,
    amount: `₪${formatAmount(ctx.deposit.amount)}`,
    fileName: originalName,
    remindersLink: reminderLink,
    companyName: ownerUser.companyName || ownerUser.name || "KLIGER",
  });
  const subject = rendered.subject;
  const body = rendered.body;

  const buf = await getBlobBytes(uploadedFilename);
  const attachments = buf
    ? [{ filename: originalName, content: buf }]
    : undefined;

  const res = await sendEmail({
    to: [advisor.email],
    subject,
    body,
    attachments,
    reminderId,
    clientId: ctx.client.id,
    fromUserId: ownerUser.id,
  });

  await logMessage({
    reminderId,
    direction: "system",
    subject,
    body,
    emailStatus: res.ok ? "sent" : "error",
    emailError: res.error ?? null,
    metadata: { kind: "notify_advisor_upload" },
  });
}

export async function notifyAdvisorSnoozeDue(reminderId: string): Promise<void> {
  const ctx = await loadReminderContext(reminderId);
  if (!ctx) return;
  const ownerUser = await getUserById(ctx.reminder.ownerId);
  if (!ownerUser) return;
  const advisor = userAsAdvisor(ownerUser);

  const subject = `⏰ תזכורת חזרה לטיפול - ${ctx.client.name}`;
  const body = [
    `שלום ${advisor.name},`,
    "",
    `תזכורת עבור הלקוח ${ctx.client.name} חזרה לטיפול (הסתיים זמן ההמתנה).`,
    `סוג הפקדה: ${depositTypeLabel[ctx.deposit.depositType]}`,
    `סכום: ₪${formatAmount(ctx.deposit.amount)}`,
    "",
    `סטטוס חדש: ממתין לטיפול יועץ.`,
  ].join("\n");

  const res = await sendEmail({
    to: [advisor.email],
    subject,
    body,
    reminderId,
    clientId: ctx.client.id,
    fromUserId: ownerUser.id,
  });

  await logMessage({
    reminderId,
    direction: "system",
    subject,
    body,
    emailStatus: res.ok ? "sent" : "error",
    emailError: res.error ?? null,
    metadata: { kind: "notify_advisor_snooze_due" },
  });
}

/**
 * דיגסט יומי ליועץ מסוים — כל הממתינים (פעולה / תשלום).
 */
export async function sendAdvisorPendingDigestForUser(userId: string): Promise<{
  ok: boolean;
  count: number;
  error?: string;
}> {
  const sql = getSql();
  const ownerUser = await getUserById(userId);
  if (!ownerUser) return { ok: false, count: 0, error: "משתמש לא נמצא" };
  if (!ownerUser.autoRemindersEnabled) return { ok: true, count: 0 };
  const advisor = userAsAdvisor(ownerUser);

  const rows = await sql`
    SELECT r.id AS rid,
           r.target_date AS target_date,
           r.action_done_at AS action_done_at,
           r.payment_done_at AS payment_done_at,
           r.paid_at AS paid_at,
           r.status AS status,
           c.name AS client_name,
           d.deposit_type AS deposit_type,
           d.amount AS amount
    FROM reminders r
    JOIN clients c ON c.id = r.client_id
    JOIN deposits d ON d.id = r.deposit_id
    WHERE r.owner_id = ${userId}
      AND r.status NOT IN ('resolved')
      AND (
        r.action_done_at IS NULL
        OR (
          d.deposit_type IN ('salary_slip', 'kollel_scholarship')
          AND r.payment_done_at IS NULL
          AND r.paid_at IS NULL
        )
      )
    ORDER BY r.target_date ASC
  `;
  const digestRows = rows as Array<{
    rid: string;
    target_date: string;
    action_done_at: string | null;
    payment_done_at: string | null;
    paid_at: string | null;
    status: string;
    client_name: string;
    deposit_type: Deposit["depositType"];
    amount: number;
  }>;

  if (digestRows.length === 0) return { ok: true, count: 0 };

  const lastRows = await sql`
    SELECT sent_at FROM email_log
    WHERE to_addresses = ${JSON.stringify([advisor.email])}
      AND subject LIKE '%סיכום ממתינים%'
    ORDER BY sent_at DESC LIMIT 1
  `;
  const last = lastRows[0] as { sent_at: string } | undefined;
  if (last) {
    const diff = Date.now() - new Date(last.sent_at).getTime();
    if (diff < 20 * 60 * 60 * 1000) {
      return { ok: true, count: digestRows.length };
    }
  }

  const groups = {
    actionPending: digestRows.filter((r) => !r.action_done_at),
    paymentPending: digestRows.filter(
      (r) =>
        !!r.action_done_at &&
        depositRequiresPayment(r.deposit_type) &&
        !r.payment_done_at &&
        !r.paid_at
    ),
    salaryActionNoPay: digestRows.filter(
      (r) =>
        r.deposit_type === "salary_slip" &&
        !!r.action_done_at &&
        !r.payment_done_at &&
        !r.paid_at
    ),
    salaryPayNoAction: digestRows.filter(
      (r) =>
        r.deposit_type === "salary_slip" &&
        !r.action_done_at &&
        (!!r.payment_done_at || !!r.paid_at)
    ),
    scholarshipActionNoPay: digestRows.filter(
      (r) =>
        r.deposit_type === "kollel_scholarship" &&
        !!r.action_done_at &&
        !r.payment_done_at &&
        !r.paid_at
    ),
    scholarshipPayNoAction: digestRows.filter(
      (r) =>
        r.deposit_type === "kollel_scholarship" &&
        !r.action_done_at &&
        (!!r.payment_done_at || !!r.paid_at)
    ),
  };

  const line = (r: (typeof digestRows)[0]) => {
    const target = format(parseISO(r.target_date), "dd/MM/yyyy");
    return `• ${r.client_name} - ${depositTypeLabel[r.deposit_type]} ₪${formatAmount(r.amount)} (יעד ${target})`;
  };

  const baseUrl = process.env.APP_URL || "";
  const reminderLink = baseUrl ? `${baseUrl}/reminders` : "/reminders";

  const digestParts: string[] = [];
  if (groups.actionPending.length) {
    digestParts.push(`ממתינים לביצוע פעולה (${groups.actionPending.length}):`);
    digestParts.push(...groups.actionPending.map(line), "");
  }
  if (groups.paymentPending.length) {
    digestParts.push(`בוצע ולא שולם (${groups.paymentPending.length}):`);
    digestParts.push(...groups.paymentPending.map(line), "");
  }
  if (groups.salaryPayNoAction.length) {
    digestParts.push(`תלוש — שולם ולא בוצע (${groups.salaryPayNoAction.length}):`);
    digestParts.push(...groups.salaryPayNoAction.map(line), "");
  }
  if (groups.scholarshipPayNoAction.length) {
    digestParts.push(
      `מילגה — שולם ולא בוצע (${groups.scholarshipPayNoAction.length}):`
    );
    digestParts.push(...groups.scholarshipPayNoAction.map(line), "");
  }

  const templates = mergeTemplates(ownerUser.emailTemplates);
  const rendered = renderTemplate(templates.waiting_digest, {
    advisorName: advisor.name,
    itemCount: String(digestRows.length),
    digestBody: digestParts.join("\n").trim(),
    remindersLink: reminderLink,
    companyName: ownerUser.companyName || ownerUser.name || "KLIGER",
  });

  const res = await sendEmail({
    to: [advisor.email],
    subject: rendered.subject,
    body: rendered.body,
    fromUserId: ownerUser.id,
  });
  return { ok: res.ok, count: digestRows.length, error: res.error };
}

export async function sendAdvisorPendingDigestAllUsers(): Promise<void> {
  const users = await listAllActiveUsers();
  for (const u of users) {
    try {
      await sendAdvisorPendingDigestForUser(u.id);
    } catch (err) {
      console.error(
        `[KLIGER] digest error for user ${u.email}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}
