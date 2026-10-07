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
  const needsPay = depositRequiresPayment(depositType);
  if (!needsPay || paid) return false;
  if (queue === "done") return actionDone;
  return true;
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

function yesNo(on: boolean): string {
  return on ? "כן" : "לא";
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

  const digestBody = waiting
    .map((r) => {
      const type = r.deposit_type as DepositType;
      const paid = !!(r.payment_done_at || r.paid_at);
      const needsPay = depositRequiresPayment(type);
      return [
        monthLabel(r.month_bucket),
        r.client_name || "",
        r.payer_name || "—",
        formatAmount(Number(r.amount) || 0),
        depositTypeLabel[type] || r.deposit_type,
        formatDate(r.target_date),
        yesNo(!!r.action_done_at),
        needsPay ? yesNo(paid) : "—",
      ].join(" | ");
    })
    .join("\n");

  const owner = await getUserById(opts.ownerId);
  const templates = mergeTemplates(owner?.emailTemplates ?? null);
  const rendered = renderTemplate(templates.association_pending_digest, {
    associationName: association.name,
    itemCount: String(waiting.length),
    queueLabel: handlingQueueLabel(queue),
    digestBody,
    companyName: owner?.companyName || owner?.name || "KLIGER",
  });

  const res = await sendEmail({
    to: [association.email],
    subject: rendered.subject,
    body: rendered.body,
    fromUserId: opts.ownerId,
  });
  if (!res.ok) return { ok: false, error: res.error || "השליחה נכשלה" };
  return { ok: true, count: waiting.length, to: association.email };
}
