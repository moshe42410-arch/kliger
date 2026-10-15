import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { ensureSchemaExtras, getSql } from "@/lib/db";
import { AuthError, getCurrentOwnerId } from "@/lib/auth";
import {
  depositRequiresPayment,
  depositTypeLabel,
  scholarshipDeliveryLabel,
  type DepositType,
  type ScholarshipDelivery,
} from "@/lib/types";

export const dynamic = "force-dynamic";

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

function monthFromTimestamp(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

function yesNo(on: boolean): string {
  return on ? "כן" : "לא";
}

function exportSection(row: {
  deposit_type: string;
  action_done_at: string | null;
  payment_done_at: string | null;
  paid_at: string | null;
  active: number | boolean;
}): string {
  if (!row.active) return "inactive";
  const action = !!row.action_done_at;
  const paid = !!(row.payment_done_at || row.paid_at);
  const needsPay = depositRequiresPayment(row.deposit_type as DepositType);
  if (!needsPay) return action ? "archive" : "pending";
  if (action && paid) return "archive";
  if (action && !paid) return "done";
  if (!action && paid) return "paid";
  return "pending";
}

export async function GET(req: NextRequest) {
  try {
    await ensureSchemaExtras();
    const ownerId = await getCurrentOwnerId();
    const associationId = req.nextUrl.searchParams.get("associationId") || "";
    const section = req.nextUrl.searchParams.get("section") || "";
    const sql = getSql();

    const rows = associationId
      ? await sql`
          SELECT
            r.month_bucket,
            r.target_date,
            r.payer_name,
            r.action_done_at,
            r.payment_done_at,
            r.paid_at,
            r.phase,
            c.name AS client_name,
            d.amount,
            d.deposit_type,
            d.scholarship_delivery,
            d.active,
            a.name AS association_name
          FROM reminders r
          JOIN deposits d ON d.id = r.deposit_id
          JOIN clients c ON c.id = r.client_id
          LEFT JOIN associations a ON a.id = d.association_id
          WHERE r.owner_id = ${ownerId}
            AND r.phase = 'primary'
            AND d.association_id = ${associationId}
          ORDER BY r.target_date DESC, c.name ASC
        `
      : await sql`
          SELECT
            r.month_bucket,
            r.target_date,
            r.payer_name,
            r.action_done_at,
            r.payment_done_at,
            r.paid_at,
            r.phase,
            c.name AS client_name,
            d.amount,
            d.deposit_type,
            d.scholarship_delivery,
            d.active,
            a.name AS association_name
          FROM reminders r
          JOIN deposits d ON d.id = r.deposit_id
          JOIN clients c ON c.id = r.client_id
          LEFT JOIN associations a ON a.id = d.association_id
          WHERE r.owner_id = ${ownerId}
            AND r.phase = 'primary'
          ORDER BY r.target_date DESC, c.name ASC
        `;

    const header = [
      "חודש",
      "חודש העברה",
      "עמותה",
      "שם המעביר",
      "שם המקבל",
      "סכום",
      "סוג",
      "אופן",
      "תאריך יעד",
      "בוצע",
      "שולם",
      "פעיל",
    ];
    const exportRows = (rows as Array<{
      month_bucket: string;
      target_date: string;
      payer_name: string | null;
      action_done_at: string | null;
      payment_done_at: string | null;
      paid_at: string | null;
      client_name: string;
      amount: number;
      deposit_type: string;
      scholarship_delivery: string | null;
      active: number | boolean;
      association_name: string | null;
    }>).filter((r) => !section || exportSection(r) === section);
    const data = exportRows.map((r) => {
      const type = r.deposit_type as DepositType;
      const paid = !!(r.payment_done_at || r.paid_at);
      const needsPay = depositRequiresPayment(type);
      const delivery =
        type === "kollel_scholarship"
          ? scholarshipDeliveryLabel[
              (r.scholarship_delivery || "cash") as ScholarshipDelivery
            ]
          : "";
      return [
        monthLabel(r.month_bucket || (r.target_date || "").slice(0, 7)),
        paid ? monthFromTimestamp(r.payment_done_at || r.paid_at) : "",
        r.association_name || "",
        r.payer_name || "",
        r.client_name || "",
        Number(r.amount) || 0,
        depositTypeLabel[type] || r.deposit_type,
        delivery,
        r.target_date || "",
        yesNo(!!r.action_done_at),
        needsPay ? yesNo(paid) : "—",
        yesNo(!!r.active),
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws["!cols"] = [
      { wch: 18 },
      { wch: 18 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 12 },
      { wch: 28 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "מעבירים ומקבלים");
    wb.Workbook = { Views: [{ RTL: true }] };
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const filename =
      section === "pending"
        ? "deposits-pending.xlsx"
        : section === "done"
          ? "deposits-done.xlsx"
          : section === "paid"
            ? "deposits-paid.xlsx"
            : section === "archive"
              ? "deposits-archive.xlsx"
              : section === "inactive"
                ? "deposits-inactive.xlsx"
                : "payers-recipients.xlsx";

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
