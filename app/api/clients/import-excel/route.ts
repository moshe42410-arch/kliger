import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSql, parseClient, type ClientRow } from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";
import {
  buildClientsImportTemplateBuffer,
  parseClientsExcelBuffer,
} from "@/lib/parse-clients-excel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** הורדת תבנית אקסל לייבוא לקוחות */
export async function GET() {
  try {
    await getCurrentOwnerId();
    const buf = buildClientsImportTemplateBuffer();
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="kliger-clients-template.xlsx"',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ownerId = await getCurrentOwnerId();
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "יש לצרף קובץ אקסל" }, { status: 400 });
    }
    const name = file.name || "clients.xlsx";
    if (!/\.xlsx?$/i.test(name)) {
      return NextResponse.json(
        { error: "יש להעלות קובץ Excel (.xlsx)" },
        { status: 400 }
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "הקובץ גדול מדי (עד 8MB)" },
        { status: 400 }
      );
    }

    const parsed = parseClientsExcelBuffer(buf);
    if (parsed.rows.length === 0) {
      return NextResponse.json(
        {
          error: "לא נמצאו לקוחות בקובץ",
          parseErrors: parsed.errors,
        },
        { status: 400 }
      );
    }

    const sql = getSql();
    const existingRows = (await sql`
      SELECT name FROM clients WHERE owner_id = ${ownerId}
    `) as Array<{ name: string }>;
    const existingNames = new Set(
      existingRows.map((r) => r.name.trim().toLowerCase())
    );

    const created: ReturnType<typeof parseClient>[] = [];
    const skipped: Array<{ rowNumber: number; name: string; reason: string }> =
      [];
    const insertErrors: Array<{ rowNumber: number; message: string }> = [
      ...parsed.errors,
    ];

    for (const row of parsed.rows) {
      const key = row.name.trim().toLowerCase();
      if (existingNames.has(key)) {
        skipped.push({
          rowNumber: row.rowNumber,
          name: row.name,
          reason: "לקוח עם אותו שם כבר קיים",
        });
        continue;
      }

      try {
        const id = uuid();
        await sql`
          INSERT INTO clients (
            id, owner_id, name, emails, phones, reminder_channel,
            case_type, bank, required_amount, property_value, property_address
          )
          VALUES (
            ${id}, ${ownerId}, ${row.name},
            ${JSON.stringify(row.emails)}, ${JSON.stringify(row.phones)},
            ${row.reminderChannel},
            ${row.caseType}, ${row.bank}, ${row.requiredAmount},
            ${row.propertyValue}, ${row.propertyAddress}
          )
        `;
        const rows = await sql`SELECT * FROM clients WHERE id = ${id}`;
        const client = parseClient((rows as ClientRow[])[0]);
        created.push(client);
        existingNames.add(key);
      } catch (e) {
        insertErrors.push({
          rowNumber: row.rowNumber,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      createdCount: created.length,
      skippedCount: skipped.length,
      errorCount: insertErrors.length,
      created,
      skipped,
      errors: insertErrors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
