import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { ensureSchemaExtras, getSql } from "@/lib/db";
import { AuthError, getCurrentOwnerId } from "@/lib/auth";
import {
  depositRequiresPayment,
  depositTypeLabel,
  type DepositType,
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

export async function GET(req: NextRequest) {
  try {
    await ensureSchemaExtras();
    const ownerId = await getCurrentOwnerId();
    const associationId = req.nextUrl.searchParams.get("associationId") || "";
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
            c.name AS client_name,
            d.amount,
            d.deposit_type,
            a.name AS association_name
          FROM reminders r
          JOIN deposits d ON d.id = r.deposit_id
          JOIN clients c ON c.id = r.client_id
          JOIN associations a ON a.id = d.association_id
          WHERE r.owner_id = ${ownerId}
            AND r.phase = 'primary'
            AND d.association_id = ${associationId}
          ORDER BY a.name ASC, r.target_date DESC, c.name ASC
        `
      : await sql`
          SELECT
            r.month_bucket,
            r.target_date,
            r.payer_name,
            r.action_done_at,
            r.payment_done_at,
            r.paid_at,
            c.name AS client_name,
            d.amount,
            d.deposit_type,
            a.name AS association_name
          FROM reminders r
          JOIN deposits d ON d.id = r.deposit_id
          JOIN clients c ON c.id = r.client_id
          JOIN associations a ON a.id = d.association_id
          WHERE r.owner_id = ${ownerId}
            AND r.phase = 'primary'
            AND d.association_id IS NOT NULL
          ORDER BY a.name ASC, r.target_date DESC, c.name ASC
        `;

    const header = [
      "חודש",
      "חודש העברה",
      "עמותה",
      "שם המעביר",
      "שם המקבל",
      "סכום",
      "סוג",
      "תאריך יעד",
      "בוצע",
      "שולם",
    ];
    const data = (rows as Array<{
      month_bucket: string;
      target_date: string;
      payer_name: string | null;
      action_done_at: string | null;
      payment_done_at: string | null;
      paid_at: string | null;
      client_name: string;
      amount: number;
      deposit_type: string;
      association_name: string;
    }>).map((r) => {
      const type = r.deposit_type as DepositType;
      const paid = !!(r.payment_done_at || r.paid_at);
      const needsPay = depositRequiresPayment(type);
      return [
        monthLabel(r.month_bucket),
        paid ? monthFromTimestamp(r.payment_done_at || r.paid_at) : "",
        r.association_name || "",
        r.payer_name || "",
        r.client_name || "",
        Number(r.amount) || 0,
        depositTypeLabel[type] || r.deposit_type,
        r.target_date || "",
        yesNo(!!r.action_done_at),
        needsPay ? yesNo(paid) : "—",
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
      { wch: 22 },
      { wch: 14 },
      { wch: 10 },
      { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "מעבירים ומקבלים");
    wb.Workbook = { Views: [{ RTL: true }] };
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const filename = "payers-recipients.xlsx";

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
