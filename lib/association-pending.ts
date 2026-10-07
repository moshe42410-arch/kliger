import {
  currentMonthBucket,
  ensureSchemaExtras,
  getSql,
  getUserById,
  parseAssociation,
  type AssociationRow,
} from "./db";
import { sendEmail } from "./email";
import { mergeTemplates, renderTemplate } from "./email-templates";
import {
  handlingQueueLabel,
  type AssociationHandlingQueue,
} from "./association-queue";
import { depositRequiresPayment, depositTypeLabel, type DepositType } from "./types";

export type { AssociationHandlingQueue } from "./association-queue";
export { handlingQueueLabel, parseHandlingQueue } from "./association-queue";

export function waitsForAssociation(
  queue: AssociationHandlingQueue,
  depositType: DepositType,
  actionDone: boolean,
  paid: boolean
): boolean {
  if (actionDone) return false;
  if (!depositRequiresPayment(depositType)) return false;
  if (queue === "paid") return paid;
  return !paid;
}

function monthLabel(bucket: string): string {
  const [ys, ms] = String(bucket || "").split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return bucket || "";
  return new Date(y, m - 1, 1).toLocaleDateString("he-IL", {
    month: "long",
    year: "numeric",
  });
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("he-IL");
}

const DIGEST_TABLE_TOKEN = "[[DIGEST_TABLE]]";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusHtml(label: string, on: boolean): string {
  const color = on ? "#1f7a62" : "#8a6a2f";
  const bg = on ? "#e7f6f1" : "#f8f1e3";
  return `<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:${bg};color:${color};font-size:12px;font-weight:700;">${esc(label)}: ${on ? "כן" : "לא"}</span>`;
}

function depositCardHtml(row: {
  month: string;
  client: string;
  payer: string;
  amount: string;
  type: string;
  target: string;
  actionDone: boolean;
  paid: boolean;
  needsPay: boolean;
}): string {
  const paidLabel = row.needsPay
    ? statusHtml("שולם", row.paid)
    : `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#f3f4f6;color:#6b7280;font-size:12px;">שולם: —</span>`;
  return `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;margin:0 0 10px;background:#fcfaf2;border:1px solid #eee6d4;border-radius:14px;direction:rtl;">
<tr>
<td dir="rtl" style="padding:12px 14px;text-align:right;direction:rtl;">
<div style="font-size:14px;font-weight:700;color:#0a1932;">${esc(row.month)}</div>
<div style="margin-top:4px;font-size:14px;color:#0a1932;">${esc(row.client)}</div>
<div style="margin-top:2px;font-size:13px;color:#5a6a86;">מעביר: ${esc(row.payer)}</div>
<div style="margin-top:2px;font-size:13px;color:#5a6a86;">${esc(row.type)} · יעד ${esc(row.target)}</div>
<div style="margin-top:8px;">${statusHtml("בוצע", row.actionDone)}${paidLabel}</div>
</td>
<td dir="rtl" valign="top" style="padding:12px 14px;text-align:left;white-space:nowrap;font-size:16px;font-weight:700;color:#a67912;">${esc(row.amount)}</td>
</tr>
</table>`;
}

type PendingRow = {
  month_bucket: string;
  target_date: string;
  payer_name: string | null;
  action_done_at: string | null;
  payment_done_at: string | null;
  paid_at: string | null;
  client_name: string;
  amount: number;
  deposit_type: string;
};

export async function sendAssociationPendingDigest(opts: {
  ownerId: string;
  associationId: string;
}): Promise<{ ok: true; count: number; to: string } | { ok: false; error: string }> {
  await ensureSchemaExtras();
  const sql = getSql();
  const assocRows = await sql`
    SELECT * FROM associations
    WHERE id = ${opts.associationId} AND owner_id = ${opts.ownerId}
    LIMIT 1
  `;
  const association = (assocRows as AssociationRow[])[0]
    ? parseAssociation((assocRows as AssociationRow[])[0])
    : null;
  if (!association) return { ok: false, error: "העמותה לא נמצאה" };
  if (!association.email) {
    return { ok: false, error: "אין מייל מוגדר לעמותה" };
  }

  const current = currentMonthBucket();
  const rows = (await sql`
    SELECT
      r.month_bucket,
      r.target_date,
      r.payer_name,
      r.action_done_at,
      r.payment_done_at,
      r.paid_at,
      c.name AS client_name,
      d.amount,
      d.deposit_type
    FROM reminders r
    JOIN deposits d ON d.id = r.deposit_id
    JOIN clients c ON c.id = r.client_id
    WHERE r.owner_id = ${opts.ownerId}
      AND r.phase = 'primary'
      AND d.association_id = ${association.id}
      AND r.month_bucket IS NOT NULL
      AND r.month_bucket <= ${current}
    ORDER BY r.month_bucket DESC, c.name ASC
  `) as PendingRow[];

  const queue = association.handlingQueue;
  const waiting = rows.filter((r) => {
    const paid = !!(r.payment_done_at || r.paid_at);
    return waitsForAssociation(
      queue,
      r.deposit_type as DepositType,
      !!r.action_done_at,
      paid
    );
  });

  if (waiting.length === 0) {
    return {
      ok: false,
      error: "אין הפקדות שממתינות לטיפול העמותה לפי ההגדרה שלה",
    };
  }

  const cards = waiting.map((r) => {
    const type = r.deposit_type as DepositType;
    const paid = !!(r.payment_done_at || r.paid_at);
    const actionDone = !!r.action_done_at;
    const needsPay = depositRequiresPayment(type);
    const fields = {
      month: monthLabel(r.month_bucket),
      client: r.client_name || "",
      payer: r.payer_name || "—",
      amount: formatAmount(Number(r.amount) || 0),
      type: depositTypeLabel[type] || r.deposit_type,
      target: formatDate(r.target_date),
      actionDone,
      paid,
      needsPay,
    };
    const plain = [
      fields.month,
      `מקבל: ${fields.client}`,
      `מעביר: ${fields.payer}`,
      `סכום: ${fields.amount}`,
      `סוג: ${fields.type}`,
      `תאריך יעד: ${fields.target}`,
      `בוצע: ${actionDone ? "כן" : "לא"}`,
      `שולם: ${needsPay ? (paid ? "כן" : "לא") : "—"}`,
    ].join("\n");
    return { html: depositCardHtml(fields), plain };
  });
  const digestBody = cards.map((c) => c.plain).join("\n\n");
  const digestHtml = cards.map((c) => c.html).join("");

  const owner = await getUserById(opts.ownerId);
  const templates = mergeTemplates(owner?.emailTemplates ?? null);
  const rendered = renderTemplate(templates.association_pending_digest, {
    associationName: association.name,
    itemCount: String(waiting.length),
    queueLabel: handlingQueueLabel(queue),
    digestBody,
    digestTable: DIGEST_TABLE_TOKEN,
    companyName: owner?.companyName || owner?.name || "KLIGER",
  });

  const res = await sendEmail({
    to: [association.email],
    subject: rendered.subject,
    body: rendered.body,
    fromUserId: opts.ownerId,
    htmlParts: { [DIGEST_TABLE_TOKEN]: digestHtml },
    textParts: { [DIGEST_TABLE_TOKEN]: digestBody },
  });
  if (!res.ok) return { ok: false, error: res.error || "השליחה נכשלה" };
  return { ok: true, count: waiting.length, to: association.email };
}
