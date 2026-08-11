import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  nowIso,
  parseClient,
  type CaseType,
  type ClientRow,
  type ReminderChannel,
} from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";
import { CASE_TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseOptionalNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseCaseFields(body: Record<string, unknown>) {
  const caseTypeRaw = body.caseType != null ? String(body.caseType) : null;
  const caseType =
    caseTypeRaw && (CASE_TYPES as string[]).includes(caseTypeRaw)
      ? (caseTypeRaw as CaseType)
      : null;
  const bankRaw = body.bank != null ? String(body.bank).trim() : null;
  const bank = bankRaw || null;
  const requiredAmount = parseOptionalNumber(body.requiredAmount);
  const propertyValue = parseOptionalNumber(body.propertyValue);
  const propertyAddress =
    body.propertyAddress != null
      ? String(body.propertyAddress).trim() || null
      : null;
  const driveFolderUrl =
    body.driveFolderUrl != null
      ? String(body.driveFolderUrl).trim() || null
      : null;
  const driveFolderId =
    body.driveFolderId != null
      ? String(body.driveFolderId).trim() || null
      : null;
  const spouseName =
    body.spouseName != null ? String(body.spouseName).trim() || null : null;
  const spouseEmail =
    body.spouseEmail != null ? String(body.spouseEmail).trim() || null : null;
  const spousePhone =
    body.spousePhone != null ? String(body.spousePhone).trim() || null : null;
  return {
    caseType,
    bank,
    requiredAmount,
    propertyValue,
    propertyAddress,
    driveFolderUrl,
    driveFolderId,
    spouseName,
    spouseEmail,
    spousePhone,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM clients WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    const row = (rows as ClientRow[])[0];
    if (!row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    return NextResponse.json(parseClient(row));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const body = await req.json();
    const name = String(body.name || "").trim();
    const emails = (Array.isArray(body.emails) ? body.emails : [])
      .map((x: unknown) => String(x || "").trim())
      .filter(Boolean);
    const phones = (Array.isArray(body.phones) ? body.phones : [])
      .map((x: unknown) => String(x || "").trim())
      .filter(Boolean);
    const channel = (body.reminderChannel || "email") as ReminderChannel;
    const caseFields = parseCaseFields(body);
    if (!name) return NextResponse.json({ error: "שם חובה" }, { status: 400 });

    const sql = getSql();
    const existsRows = (await sql`
      SELECT id FROM clients WHERE id = ${params.id} AND owner_id = ${ownerId}
    `) as Array<{ id: string }>;
    if (!existsRows[0]) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    await sql`
      UPDATE clients
      SET name = ${name},
          emails = ${JSON.stringify(emails)},
          phones = ${JSON.stringify(phones)},
          reminder_channel = ${channel},
          case_type = ${caseFields.caseType},
          bank = ${caseFields.bank},
          required_amount = ${caseFields.requiredAmount},
          property_value = ${caseFields.propertyValue},
          property_address = ${caseFields.propertyAddress},
          drive_folder_url = ${caseFields.driveFolderUrl},
          drive_folder_id = ${caseFields.driveFolderId},
          spouse_name = ${caseFields.spouseName},
          spouse_email = ${caseFields.spouseEmail},
          spouse_phone = ${caseFields.spousePhone},
          updated_at = ${nowIso()}
      WHERE id = ${params.id}
    `;
    const rows = await sql`SELECT * FROM clients WHERE id = ${params.id}`;
    return NextResponse.json(parseClient((rows as ClientRow[])[0]));
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
      DELETE FROM clients WHERE id = ${params.id} AND owner_id = ${ownerId}
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
